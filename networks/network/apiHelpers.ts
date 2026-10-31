// ═══════════════════════════════════════════════════════
// MetroMatrix — API Infrastructure (Production)
// ═══════════════════════════════════════════════════════
// The main network file, as FinMatrix's: the ONE axios client and everything
// every network function shares — the base URL, the bearer and refresh
// interceptors, the error codes and ApiError, query helpers and the upload
// transport. Every network function in networks/** goes through `api`;
// nothing else in the app imports axios.

import { Platform } from 'react-native';
import axios, { AxiosAdapter, AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, CONFIG_ERROR } from '../../config/env';
import { setTokens, getAccessToken, getRefreshToken, clearTokens } from '../../utils/storage_utils/storageUtils';
import {
  emitSessionExpired,
  emitBusinessStatusStale,
  isIntentionalSignOut,
  emitPlatformNotice,
} from '../../utils/auth-events/authEvents';
import type { LocalFile, SignedUpload, UploadedFile } from '../../models/auth';

// ★ BACKEND BASE URL ★
// EXPO_PUBLIC_API_URL, read by config/env.ts (the one module that reads
// process.env), e.g. http://localhost:3000/api/v1 in .env.local. There is no
// default: a build without it shows ConfigErrorScreen and sends nothing. On a
// physical device use the machine's LAN address, not localhost.
export { API_BASE_URL };

// Token storage lives in utils/storage_utils/storageUtils.ts; re-exported here so the domain
// network files keep importing everything they need from the shared client.
export { setTokens, getAccessToken, getRefreshToken, clearTokens };

// ─── Error Codes ────────────────────────────────────
// The codes the app branches on, by the API's names
// (MetroMatrix_Backend src/common/errors/codes.ts), plus the few the app makes
// up itself. Compare against these constants, never a string typed inline, so
// a rename on either side fails the type check instead of silently not
// matching. `errorCopy` (below) is what a person reads for each.

/** The API's codes the auth and account flows use. */
const API_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  WRONG_PORTAL: 'WRONG_PORTAL',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  VERIFY_LINK_INVALID: 'VERIFY_LINK_INVALID',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_LOCKED: 'OTP_LOCKED',
  RESEND_COOLDOWN: 'RESEND_COOLDOWN',
  REFRESH_INVALID: 'REFRESH_INVALID',
  REFRESH_REUSED: 'REFRESH_REUSED',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  TOTP_REQUIRED: 'TOTP_REQUIRED',
  TOTP_INVALID: 'TOTP_INVALID',
  BUSINESS_SUSPENDED: 'BUSINESS_SUSPENDED',
  DOCUMENTS_MISSING: 'DOCUMENTS_MISSING',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  // The super admin's platform switches (GET /config, ADMIN_API.md §5).
  MAINTENANCE: 'MAINTENANCE',
  SERVICE_PAUSED: 'SERVICE_PAUSED',
  SIGNUPS_PAUSED: 'SIGNUPS_PAUSED',
} as const;

/** Codes only the app produces. */
const APP_CODES = {
  /** No response at all: offline, DNS, timeout. */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /** A build with no backend URL (config/env.ts). */
  CONFIG_ERROR: 'CONFIG_ERROR',
  /** The server answered 2xx with something the app can't read. */
  BAD_RESPONSE: 'BAD_RESPONSE',
  /** Refresh was needed but no refresh token is stored. */
  NO_REFRESH_TOKEN: 'NO_REFRESH_TOKEN',
  /** The person closed the Google sheet. */
  GOOGLE_CANCELLED: 'GOOGLE_CANCELLED',
  /** "I Verified My Email" before the link was opened. */
  NOT_VERIFIED: 'NOT_VERIFIED',
} as const;

export const ERROR_CODES = { ...API_CODES, ...APP_CODES } as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

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
// The real API (config/env.ts), as in FinMatrix. With no backend URL
// every request fails with CONFIG_ERROR and nothing goes on the network
// (AppContainer shows ConfigErrorScreen).
const configErrorAdapter: AxiosAdapter = () =>
  Promise.reject(new ApiError('This build has no server address. Reinstall the app or contact support.', CONFIG_ERROR_CODE));

const clientConfig = {
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  ...(CONFIG_ERROR ? { adapter: configErrorAdapter } : null),
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

// ─── Session Refresh Rules ──────────────────────────
// When does a session end? Only when the server says so. A refresh that fails
// because the phone is offline, the API is restarting (5xx) or throttling
// (429) must not wipe a perfectly good session: the request fails, the tokens
// stay, and the next request tries again. FinMatrix's lesson: signing people
// out on a blip teaches them the app "forgets" them.

/** Set by refreshTokens when there is nothing to refresh with. */
export const NO_REFRESH_TOKEN = ERROR_CODES.NO_REFRESH_TOKEN;

/** 401 codes meaning "this session is over" (MetroMatrix_Backend docs/API_AUTH.md §3). */
const DEAD_SESSION_401 = new Set<string>([
  ERROR_CODES.REFRESH_INVALID,
  ERROR_CODES.REFRESH_REUSED,
  ERROR_CODES.TOKEN_REVOKED,
]);

const statusOf = (err: unknown): number | undefined => {
  if (axios.isAxiosError(err)) return err.response?.status;
  const s = (err as { status?: unknown } | null)?.status;
  return typeof s === 'number' ? s : undefined;
};

const codeOf = (err: unknown): string | undefined => {
  if (axios.isAxiosError(err)) {
    if (!err.response) return ERROR_CODES.NETWORK_ERROR;
    const data = err.response.data as { error?: { code?: string }; code?: string } | undefined;
    return data?.error?.code ?? data?.code;
  }
  const c = (err as { code?: unknown } | null)?.code;
  return typeof c === 'string' ? c : undefined;
};

/**
 * The failure ends the session (clear tokens, back to sign-in):
 *  - 401 REFRESH_INVALID, REFRESH_REUSED or TOKEN_REVOKED
 *  - 403 ACCOUNT_DISABLED
 *  - no refresh token stored
 */
export const isDefinitiveSessionFailure = (err: unknown): boolean => {
  const code = codeOf(err);
  if (code === NO_REFRESH_TOKEN) return true;
  const status = statusOf(err);
  if (status === 401 && code !== undefined && DEAD_SESSION_401.has(code)) return true;
  return status === 403 && code === ERROR_CODES.ACCOUNT_DISABLED;
};

/** Worth retrying later: offline, timed out, the server failing (5xx) or throttling (429). */
export const isTransient = (err: unknown): boolean => {
  if (codeOf(err) === ERROR_CODES.NETWORK_ERROR) return true;
  const status = statusOf(err);
  return status === 429 || (status !== undefined && status >= 500);
};

/** The code to tell the user why they were signed out (AppContainer's toast). */
export const sessionEndReason = (err: unknown): string => codeOf(err) ?? 'SESSION_ENDED';

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
      throw new ApiError('Please sign in again.', NO_REFRESH_TOKEN, 401);
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

    // ── The platform's switches (GET /config), flipped mid-session ──
    // The handler (AppContainer) records them, and the app shows the
    // maintenance, service-paused or sign-ups-paused screen at once.
    reportPlatformNotice(status, error);

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

const PAUSABLE = ['shopping', 'healthcare', 'food', 'kitchen'] as const;

const reportPlatformNotice = (status: number | undefined, error: AxiosError) => {
  const body = error.response?.data as
    | { error?: { code?: string; message?: string; details?: Record<string, unknown> } }
    | undefined;
  const code = body?.error?.code;
  const details = body?.error?.details ?? {};
  const service = PAUSABLE.find(s => s === details.service);
  if (status === 503 && code === 'MAINTENANCE') {
    emitPlatformNotice({ kind: 'maintenance', message: String(details.message ?? body?.error?.message ?? '') });
  } else if (status === 503 && code === 'SERVICE_PAUSED' && service) {
    emitPlatformNotice({ kind: 'service_paused', service });
  } else if (status === 403 && code === 'SIGNUPS_PAUSED' && (details.role === 'customer' || details.role === 'partner')) {
    emitPlatformNotice({ kind: 'signups_paused', role: details.role });
  }
};

// ─── Error Extractor ────────────────────────────────
export const extractErrorMessage = (error: any): string => {
  if (error instanceof ApiError) return error.message;
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
/** Code set on an ApiError when the request never got a response. */
export const NETWORK_ERROR = ERROR_CODES.NETWORK_ERROR;

/** Code set on every request from a build with no backend URL. */
export const CONFIG_ERROR_CODE = ERROR_CODES.CONFIG_ERROR;

export const extractErrorCode = (error: any): string | undefined => {
  if (error instanceof ApiError) return error.code;
  if (axios.isAxiosError(error)) {
    if (!error.response) return NETWORK_ERROR;
    const data: any = error.response.data;
    // NestJS standard is { error: { code } }; some handlers put it at the top.
    return data?.error?.code ?? data?.code;
  }
  return error?.code;
};

/**
 * FinMatrix's ApiError: an Error that survives the trip to a screen with its
 * server code intact. Every network function throws one (`toApiError`).
 *
 * `code` matters beyond convenience: RTK's `miniSerializeError` copies exactly
 * name/message/stack/**code** off a thrown error, so a code set here is still
 * readable after `.unwrap()` on an async thunk. `status` and `details` are
 * dropped there — thunks that need them pass them through `rejectWithValue`.
 */
export class ApiError extends Error {
  code?: string;
  status?: number;
  /** The server's structured `error.details` (missing documents, retryAfter, attempts left…). */
  details?: any;
  constructor(message: string, code?: string, status?: number, details?: any) {
    super(message);
    this.name = 'ApiError';
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
export const toApiError = (error: any): ApiError => {
  if (error instanceof ApiError) return error;
  const isAxios = axios.isAxiosError(error);
  const data: any = isAxios ? error.response?.data : undefined;
  return new ApiError(
    extractErrorMessage(error),
    extractErrorCode(error),
    isAxios ? error.response?.status : undefined,
    withRetryAfter(error, data?.error?.details ?? data?.details),
  );
};

/** The plain shape a thunk hands to `rejectWithValue` so nothing is dropped. */
export interface RejectedApiError {
  message: string;
  code?: string;
  status?: number;
  details?: any;
}

export const toRejectedValue = (error: any): RejectedApiError => {
  const e = toApiError(error);
  return { message: e.message, code: e.code, status: e.status, details: e.details };
};

export const isNetworkError = (error: any): boolean => extractErrorCode(error) === NETWORK_ERROR;

/**
 * A response serializer's result, or BAD_RESPONSE when it couldn't read the
 * body: a thunk serializes right after its network call
 * (`required(cartSerializer(await getCartAPI()))`), so a malformed answer
 * fails the request instead of emptying the screen.
 */
export const required = <T>(value: T | null | undefined): T => {
  if (value === null || value === undefined) {
    throw new ApiError('The server sent something unexpected. Try again.', ERROR_CODES.BAD_RESPONSE);
  }
  return value;
};

// ─── Error Copy ─────────────────────────────────────

type Details = Record<string, unknown> | null | undefined;

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.ceil(n) : null;
};

/** "45 seconds", "3 minutes". */
const wait = (seconds: number) =>
  seconds < 90 ? `${seconds} second${seconds === 1 ? '' : 's'}` : `${Math.ceil(seconds / 60)} minutes`;

/** Seconds to wait from `details.retryAfter` (the server, or the Retry-After header via toApiError). */
export const retryAfterOf = (details: Details): number | null => num(details?.retryAfter ?? details?.retryAfterSeconds);

/**
 * What a person reads for a code, or null to keep the server's own message
 * (it already names the right thing, e.g. which field is wrong).
 */
export const errorCopy = (code: string | null | undefined, details?: Details): string | null => {
  const retry = retryAfterOf(details);
  switch (code) {
    case ERROR_CODES.NETWORK_ERROR:
      return "You're offline. Check your connection, then try again.";
    case ERROR_CODES.CONFIG_ERROR:
      return "This version can't connect. Install the latest version of MetroMatrix.";
    case ERROR_CODES.REFRESH_REUSED:
      return 'You were signed out for security. Please sign in again.';
    case ERROR_CODES.TOKEN_REVOKED:
    case ERROR_CODES.REFRESH_INVALID:
    case ERROR_CODES.NO_REFRESH_TOKEN:
      return 'Your session has ended. Please sign in again.';
    case ERROR_CODES.ACCOUNT_DISABLED:
      return 'This account has been disabled. Contact MetroMatrix support.';
    case ERROR_CODES.RESEND_COOLDOWN:
      return retry ? `We just sent one. You can ask again in ${wait(retry)}.` : 'We just sent one. Try again in a minute.';
    case ERROR_CODES.RATE_LIMITED:
      return retry ? `Too many attempts. Try again in ${wait(retry)}.` : 'Too many attempts. Wait a moment, then try again.';
    case ERROR_CODES.VERIFY_LINK_INVALID:
      return 'This link has expired or been replaced. Open the app and tap Resend.';
    case ERROR_CODES.EMAIL_NOT_VERIFIED:
      return 'Verify your email address first: open the link we sent you.';
    case ERROR_CODES.EMAIL_EXISTS:
      return 'An account with this email already exists. Sign in instead.';
    case ERROR_CODES.TOTP_INVALID:
      return "That code didn't work. Wait for the next code in your authenticator and try again.";
    case ERROR_CODES.TOTP_REQUIRED:
      return 'Set up your authenticator app to continue.';
    case ERROR_CODES.BUSINESS_SUSPENDED:
      return 'Your business is paused. Contact MetroMatrix support.';
    default:
      return null;
  }
};

/**
 * VALIDATION_FAILED's `details.fields` ({ password: ['…', '…'] }) as one
 * message per field, for showing next to the inputs.
 */
export const fieldErrors = (details: Details): Record<string, string> => {
  const fields = details?.fields;
  if (!fields || typeof fields !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [field, messages] of Object.entries(fields as Record<string, unknown>)) {
    const first = Array.isArray(messages) ? messages.find(m => typeof m === 'string') : messages;
    if (typeof first === 'string' && first) out[field] = first;
  }
  return out;
};

// ─── Query Params ───────────────────────────────────
// Network functions send query parameters as axios `{ params }`.

/** `?page=&pageSize=` for list endpoints. */
export const pageParams = (page: number, pageSize: number) => ({ page, pageSize });

/** Drop undefined / null / '' / false so the query string stays clean. */
export const clean = (params: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false));

// ─── Upload (XMLHttpRequest to Cloudinary, NOT axios) ─
// The file goes straight to Cloudinary with the parameters the API signed
// (POST /media/sign-upload); it never passes through the API. FinMatrix's
// postMultipart, for MetroMatrix's signed uploads: everything but `file` and
// `api_key` is signed, so each value is sent exactly as given.
// XMLHttpRequest, not axios or fetch: it is the only API that reports upload
// progress on native AND web. Native posts a { uri, name, type } part; web
// posts the real Blob (RN's object trick serializes to "[object Object]").

const extensionOf = (file: LocalFile): string => {
  const fromName = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (fromName && fromName !== file.name.toLowerCase()) return fromName === 'jpeg' ? 'jpg' : fromName;
  const fromMime = file.mimeType.split('/')[1]?.toLowerCase() ?? '';
  return fromMime === 'jpeg' ? 'jpg' : fromMime;
};

/**
 * What Cloudinary would refuse anyway, said before the upload starts: a file
 * over the purpose's size limit, or a format it doesn't allow. Null when fine.
 */
export const uploadProblem = (file: LocalFile & { size?: number }, signed: SignedUpload): string | null => {
  if (signed.maxBytes && typeof file.size === 'number' && file.size > signed.maxBytes) {
    return `That file is too large. The limit is ${Math.floor(signed.maxBytes / 1_000_000)} MB.`;
  }
  if (signed.allowedFormats) {
    const allowed = signed.allowedFormats.split(',').map(f => (f.trim() === 'jpeg' ? 'jpg' : f.trim()));
    const ext = extensionOf(file);
    if (ext && !allowed.includes(ext)) {
      return `That file type isn't accepted. Use ${signed.allowedFormats.split(',').join(', ').toUpperCase()}.`;
    }
  }
  return null;
};

const appendFile = async (form: FormData, file: LocalFile) => {
  if (Platform.OS === 'web') {
    const blob = file.file ?? (await (await fetch(file.uri)).blob());
    (form as unknown as { append: (k: string, v: Blob, n: string) => void }).append('file', blob, file.name);
    return;
  }
  form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
};

/** Resolves with the stored file; onProgress receives 0..1. */
export const uploadToCloudinary = async (
  file: LocalFile,
  signed: SignedUpload,
  onProgress?: (fraction: number) => void,
): Promise<UploadedFile> => {
  const problem = uploadProblem(file, signed);
  if (problem) throw new ApiError(problem, ERROR_CODES.VALIDATION_FAILED);
  const form = new FormData();
  await appendFile(form, file);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', String(signed.timestamp));
  form.append('signature', signed.signature);
  // Signed by the API: each must be sent exactly as given, or Cloudinary refuses.
  if (signed.folder) form.append('folder', signed.folder);
  // Signed with the rest: Cloudinary refuses the upload if these are missing.
  if (signed.allowedFormats) form.append('allowed_formats', signed.allowedFormats);
  if (signed.type) form.append('type', signed.type);

  return new Promise<UploadedFile>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', signed.uploadUrl);
    xhr.timeout = 120000;
    xhr.upload.onprogress = event => {
      if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      let body: any = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.secure_url) {
        onProgress?.(1);
        resolve({
          url: String(body.secure_url ?? ''),
          publicId: String(body.public_id ?? ''),
          mimeType: file.mimeType,
        });
      } else {
        reject(
          new ApiError(
            body?.error?.message ?? `Upload failed (${xhr.status}). Please try again.`,
            'UPLOAD_FAILED',
            xhr.status,
          ),
        );
      }
    };
    xhr.onerror = () =>
      reject(new ApiError("Upload failed — you're offline or the connection dropped.", 'NETWORK_ERROR'));
    xhr.ontimeout = () => reject(new ApiError('Upload timed out. Please try again.', 'NETWORK_ERROR'));
    xhr.send(form);
  });
};
