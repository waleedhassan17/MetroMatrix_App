// ═══════════════════════════════════════════════════════
// MetroMatrix — API Infrastructure
// ═══════════════════════════════════════════════════════
// The ONE axios client. Every network function in src/networks/** goes
// through `api`; nothing else in the app imports axios.

import axios, { AxiosAdapter, AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, CONFIG_ERROR, MOCK_BASE_URL, USE_MOCK_API } from '../../config/env';
import { NO_REFRESH_TOKEN, isDefinitiveSessionFailure, sessionEndReason } from './sessionRefresh';
import { ERROR_CODES } from './errorCodes';
import { setTokens, getAccessToken, getRefreshToken, clearTokens } from '../../utils/storageUtils';
import {
  emitSessionExpired,
  emitBusinessStatusStale,
  isIntentionalSignOut,
} from '../../utils/authEvents';

export { API_BASE_URL };

// Token storage lives in utils/storageUtils.ts; re-exported here so the domain
// network files keep importing everything they need from the shared client.
export { setTokens, getAccessToken, getRefreshToken, clearTokens };

// ─── Auth paths the client itself must know about ───
// Per MetroMatrix_Backend docs/API_AUTH.md §4.1 and §4.4.
export const AUTH_PATHS = {
  signin: '/auth/signin',
  signup: '/auth/signup',
  google: '/auth/google',
  adminTotp: '/auth/admin/totp',
  refresh: '/auth/refresh-token',
  logout: '/auth/logout',
  verifyEmail: '/auth/verify-email',
  forgotPassword: '/auth/forgot-password',
  verifyResetOtp: '/auth/verify-otp',
  resetPassword: '/auth/reset-password',
  // First admin sign-in: authenticated by the sign-in challenge, not a session.
  adminTotpEnrol: '/admin/me/totp/enrol',
  adminTotpConfirm: '/admin/me/totp/confirm',
} as const;

// A 401 from these IS the real answer (wrong password, bad OTP, dead refresh
// token, expired admin challenge). Refreshing on them would loop or mask the error.
const NO_REFRESH_PATHS: string[] = [
  AUTH_PATHS.signin,
  AUTH_PATHS.signup,
  AUTH_PATHS.google,
  AUTH_PATHS.adminTotp,
  AUTH_PATHS.refresh,
  AUTH_PATHS.forgotPassword,
  AUTH_PATHS.verifyResetOtp,
  AUTH_PATHS.resetPassword,
  AUTH_PATHS.adminTotpEnrol,
  AUTH_PATHS.adminTotpConfirm,
];

// ─── Axios Instances ────────────────────────────────
// Which adapter answers (src/config/env.ts):
//   • a dev build with EXPO_PUBLIC_USE_MOCK_API=1 → the dummy API
//     (./mock/mockServer.ts). Required, not imported, behind `__DEV__ &&`, so
//     a release bundle doesn't contain it at all.
//   • no backend URL → every request fails with CONFIG_ERROR and nothing
//     goes on the network (AppContainer shows ConfigErrorScreen).
//   • otherwise the network.
const configErrorAdapter: AxiosAdapter = () =>
  Promise.reject(new AuthError('This build has no server address. Reinstall the app or contact support.', CONFIG_ERROR_CODE));

let adapter: AxiosAdapter | undefined;
if (__DEV__ && USE_MOCK_API) {
  adapter = require('./mock/mockServer').mockAdapter as AxiosAdapter;
} else if (CONFIG_ERROR) {
  adapter = configErrorAdapter;
}

const clientConfig = {
  baseURL: USE_MOCK_API ? MOCK_BASE_URL : API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  ...(adapter ? { adapter } : null),
};

export const api = axios.create(clientConfig);

/**
 * The refresh call's own client: it must bypass the interceptors it serves
 * (a 401 there must not trigger another refresh).
 */
export const refreshClient = axios.create(clientConfig);

// ─── Request Interceptor ────────────────────────────
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // A caller that passes its own Authorization (sign-out revoking a token
    // already cleared from storage) keeps it.
    if (!config.headers.Authorization) {
      const token = await getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  error => Promise.reject(error),
);

// ─── Envelope unwrapping ────────────────────────────
// The API wraps payloads as { success: true, data, message? }
// (MetroMatrix_Backend response-envelope.interceptor.ts); a bare body is tolerated.
export const unwrapBody = <T = any>(body: any): T => (body?.data ?? body) as T;
export const unwrap = <T = any>(response: AxiosResponse): T => unwrapBody<T>(response.data);

// ─── Single-flight refresh ──────────────────────────
// Refresh ROTATES the token pair, so two racing refreshes would revoke each
// other. The first caller performs it; every caller that arrives while it is
// in flight queues and is resolved (or rejected) with the same outcome.
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error || !token) {
      reject(error ?? new Error('Refresh failed'));
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Swap the stored refresh token for a new pair. Resolves to the new access
 * token; rejects when the session cannot be refreshed (with NO_REFRESH_TOKEN
 * when none is stored). Never clears tokens itself — the 401 path below (and
 * bootstrapSession) decide that with isDefinitiveSessionFailure, so a
 * proactive caller can try a refresh without risking the session.
 */
export const refreshTokens = async (): Promise<string> => {
  if (isRefreshing) {
    return new Promise<string>((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;
  try {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      throw new AuthError('Please sign in again.', NO_REFRESH_TOKEN, 401);
    }
    // refreshClient, not `api`: the refresh call must not pass through the
    // interceptors it is serving.
    const { data } = await refreshClient.post(AUTH_PATHS.refresh, { refreshToken });
    // The API answers a bare TokenPair: { accessToken, refreshToken, expiresIn }.
    const pair = unwrapBody<any>(data);
    if (typeof pair?.accessToken !== 'string' || typeof pair?.refreshToken !== 'string') {
      throw new Error('No token in refresh response');
    }
    await setTokens(pair.accessToken, pair.refreshToken);
    processQueue(null, pair.accessToken);
    return pair.accessToken as string;
  } catch (e) {
    processQueue(e, null);
    throw e;
  } finally {
    isRefreshing = false;
  }
};

// ─── Response Interceptor (401 refresh, 403 status gates) ───
api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const url = originalRequest?.url ?? '';
    const status = error.response?.status;
    const isAuthRoute = NO_REFRESH_PATHS.some(p => url.includes(p));

    // ── Business suspended mid-session (server gate) ──
    // Redux only learns the business status at sign-in / cold start. The
    // handler (AppContainer) re-fetches /auth/me and the navigator routes to
    // the Suspended gate.
    if (status === 403 && extractErrorCode(error) === ERROR_CODES.BUSINESS_SUSPENDED) {
      emitBusinessStatusStale();
    }

    // ── Account disabled mid-session: definitive, whichever request hears it ──
    // (Not on the sign-in routes: there is no session there to end.)
    if (
      status === 403 &&
      !isAuthRoute &&
      extractErrorCode(error) === ERROR_CODES.ACCOUNT_DISABLED &&
      !isIntentionalSignOut()
    ) {
      await clearTokens();
      emitSessionExpired(ERROR_CODES.ACCOUNT_DISABLED);
      return Promise.reject(error);
    }

    // The user just signed out on purpose: a 401 on a request still in flight
    // is expected. Refreshing would fail (its token was revoked), and a late
    // failure could clear the tokens of a sign-in made moments later.
    if (status === 401 && !isAuthRoute && isIntentionalSignOut()) {
      return Promise.reject(error);
    }

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;
      // Read BEFORE awaiting: refreshTokens sets the flag synchronously, so
      // this tells the request that runs the refresh apart from the ones that
      // queue behind it. Only the leader clears tokens and announces expiry.
      const leadsRefresh = !isRefreshing;
      let token: string;
      try {
        token = await refreshTokens();
      } catch (refreshError) {
        // Only the server saying "this session is over" ends it
        // (sessionRefresh.ts). Offline, a 5xx or a 429 fails this request
        // alone: the tokens stay and the next request tries again.
        if (leadsRefresh && isDefinitiveSessionFailure(refreshError)) {
          await clearTokens();
          // Tell the app the session is gone so it resets and returns to
          // Welcome (handler registered in AppContainer). Skipped for the
          // logout endpoint itself — that flow already resets the store.
          if (!url.includes(AUTH_PATHS.logout)) {
            emitSessionExpired(sessionEndReason(refreshError));
          }
        }
        // The caller sees why: REFRESH_REUSED, offline, 503 … not the stale 401.
        return Promise.reject(refreshError);
      }
      originalRequest.headers.Authorization = `Bearer ${token}`;
      return api(originalRequest);
    }

    return Promise.reject(error);
  },
);

// ─── Error Extractor ────────────────────────────────
export const extractErrorMessage = (error: any): string => {
  if (error instanceof AuthError) return error.message;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data: any = error.response?.data;

    // If backend returned HTML (e.g. Heroku error page), don't try to parse it
    if (typeof data === 'string' && data.includes('<!DOCTYPE')) {
      if (status === 502 || status === 503) return 'Server is temporarily unavailable. Please try again in a moment.';
      if (status === 500) return 'Internal server error. Please try again later.';
      return `Server error (${status}). Please try again later.`;
    }

    // NestJS standard: { error: { message: '...' } }
    const serverMsg = data?.error?.message;
    if (serverMsg) return Array.isArray(serverMsg) ? serverMsg.join(', ') : String(serverMsg);
    // NestJS validation pipe: { message: '...' } or { message: ['...'] }
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : String(data.message);
    }
    if (!error.response) return "You're offline. Check your connection and try again.";
    if (status === 401) return 'Please sign in again.';
    if (status === 429) return 'Too many requests. Please wait a moment.';
    if (status === 403) return 'You do not have permission for this action.';
    if (status === 404) return 'Resource not found.';
    if (status === 502 || status === 503) return 'Server is temporarily unavailable. Please try again in a moment.';
    if (status === 500) return 'Internal server error. Please try again later.';
  }
  return error?.message || 'An unexpected error occurred.';
};

// ─── Error Code Extractor ───────────────────────────
/** Code set on an AuthError when the request never got a response. */
export const NETWORK_ERROR = ERROR_CODES.NETWORK_ERROR;

/** Code set on every request from a build with no backend URL. */
export const CONFIG_ERROR_CODE = ERROR_CODES.CONFIG_ERROR;

export const extractErrorCode = (error: any): string | undefined => {
  if (error instanceof AuthError) return error.code;
  if (axios.isAxiosError(error)) {
    if (!error.response) return NETWORK_ERROR;
    const data: any = error.response.data;
    // NestJS standard is { error: { code } }; some handlers put it at the top.
    return data?.error?.code ?? data?.code;
  }
  return error?.code;
};

/**
 * An Error that survives the trip to a screen with its server code intact.
 *
 * `code` matters beyond convenience: RTK's `miniSerializeError` copies exactly
 * name/message/stack/**code** off a thrown error, so a code set here is still
 * readable after `.unwrap()` on an async thunk. `status` and `details` are
 * dropped there — thunks that need them pass them through `rejectWithValue`.
 */
export class AuthError extends Error {
  code?: string;
  status?: number;
  /** The server's structured `error.details` (missing documents, retryAfter, attempts left…). */
  details?: any;
  constructor(message: string, code?: string, status?: number, details?: any) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * A 429's wait: the body's `details.retryAfter` when the API sets one
 * (RESEND_COOLDOWN, TOTP lockout), else the throttler's `Retry-After` header
 * (seconds), carried into `details.retryAfter` so screens read one place.
 */
const withRetryAfter = (
  error: unknown,
  details: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined => {
  if (!axios.isAxiosError(error) || error.response?.status !== 429) return details;
  if (details && details.retryAfter !== undefined) return details;
  const headers = error.response.headers as Record<string, unknown> | undefined;
  const raw = headers?.['retry-after'] ?? headers?.['Retry-After'];
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? { ...(details ?? {}), retryAfter: Math.ceil(seconds) } : details;
};

/** Wrap any caught error, keeping the readable message, code, status and details. */
export const toAuthError = (error: any): AuthError => {
  if (error instanceof AuthError) return error;
  const isAxios = axios.isAxiosError(error);
  const data: any = isAxios ? error.response?.data : undefined;
  return new AuthError(
    extractErrorMessage(error),
    extractErrorCode(error),
    isAxios ? error.response?.status : undefined,
    withRetryAfter(error, data?.error?.details ?? data?.details),
  );
};

/** The plain shape a thunk hands to `rejectWithValue` so nothing is dropped. */
export interface RejectedAuthError {
  message: string;
  code?: string;
  status?: number;
  details?: any;
}

export const toRejectedValue = (error: any): RejectedAuthError => {
  const e = toAuthError(error);
  return { message: e.message, code: e.code, status: e.status, details: e.details };
};

export const isNetworkError = (error: any): boolean => extractErrorCode(error) === NETWORK_ERROR;
