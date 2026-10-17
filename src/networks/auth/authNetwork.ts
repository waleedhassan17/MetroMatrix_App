// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth Network
// ═══════════════════════════════════════════════════════
// One function per /auth endpoint. Each: call `api`, unwrap, serialize,
// and on failure throw an AuthError carrying the server's code + details.
// Functions that open a session store the token pair HERE (FinMatrix
// convention), so a slice never touches storage.
// TODO(API_AUTH): paths and bodies per docs/API_CONTRACT_ASSUMED.md.

import {
  api,
  unwrap,
  setTokens,
  clearTokens,
  refreshTokens,
  toAuthError,
  AuthError,
  AUTH_PATHS,
} from '../network/apiHelpers';
import { clearIntentionalSignOut } from '../../utils/authEvents';
import {
  authResultSerializer,
  retryAfterSerializer,
  sessionSerializer,
  totpChallengeSerializer,
  userSerializer,
  type SessionPayload,
} from '../../serializers/authSerializer';
import type { AuthResult, Portal, SubType, TotpChallenge, User } from '../../types/auth';

// ─── Types ────────────────────────────────────────────
export interface SignupPayload {
  name: string;
  email: string;
  /** Canonical +92…. */
  phone: string;
  password: string;
  portal: Extract<Portal, 'customer' | 'partner'>;
  /** Providers: the type picked on Provider Selection. */
  subType?: SubType;
}

export interface SigninPayload {
  /** Everyone but riders: the email. */
  email?: string;
  /** Riders: the username their vendor gave them (sent as the API's `identifier`). */
  username?: string;
  password: string;
  portal: Portal;
}

export type SigninOutcome =
  | { kind: 'session'; result: AuthResult }
  | { kind: 'totp'; challenge: TotpChallenge };

// ─── Session helpers ─────────────────────────────────
const malformed = () =>
  new AuthError('The server sent an unexpected response. Please try again.', 'BAD_RESPONSE');

/** Store the pair and start a fresh session (riders included: their app is RiderNavigator). */
const openSession = async (result: AuthResult | null): Promise<AuthResult> => {
  if (!result) throw malformed();
  await setTokens(result.tokens.accessToken, result.tokens.refreshToken);
  // A new session starts: its 401s are real and must be handled.
  clearIntentionalSignOut();
  return result;
};

// ─── Sign up / sign in ───────────────────────────────
export const authSignup = async (payload: SignupPayload): Promise<AuthResult> => {
  try {
    const response = await api.post(AUTH_PATHS.signup, {
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone,
      password: payload.password,
      portal: payload.portal,
      ...(payload.subType ? { subType: payload.subType } : null),
      acceptedTerms: true,
    });
    return await openSession(authResultSerializer(unwrap(response)));
  } catch (e) {
    throw toAuthError(e);
  }
};

/**
 * Customer and partner portals return a session; the admin portal returns a
 * TOTP challenge and NO tokens — nothing is stored until the second factor.
 */
export const authSignin = async (payload: SigninPayload): Promise<SigninOutcome> => {
  try {
    const response = await api.post(AUTH_PATHS.signin, {
      // Riders sign in with a username (`identifier`, MetroMatrix-API API_AUTH.md).
      ...(payload.username !== undefined
        ? { identifier: payload.username.trim().toLowerCase() }
        : { email: (payload.email ?? '').trim().toLowerCase() }),
      password: payload.password,
      portal: payload.portal,
    });
    const body = unwrap(response);
    const challenge = totpChallengeSerializer(body);
    if (challenge) return { kind: 'totp', challenge };
    return { kind: 'session', result: await openSession(authResultSerializer(body)) };
  } catch (e) {
    throw toAuthError(e);
  }
};

/** Second factor: a 6-digit TOTP code or a single-use recovery code. */
export const authAdminTotp = async (
  challengeToken: string,
  factor: { code: string } | { recoveryCode: string },
): Promise<AuthResult> => {
  try {
    const response = await api.post(AUTH_PATHS.adminTotp, { challengeToken, ...factor });
    return await openSession(authResultSerializer(unwrap(response)));
  } catch (e) {
    throw toAuthError(e);
  }
};

/** Exchange a Google ID token (never an access token) for a session. */
export const authGoogle = async (idToken: string): Promise<AuthResult> => {
  try {
    const response = await api.post(AUTH_PATHS.google, { idToken, portal: 'customer' });
    return await openSession(authResultSerializer(unwrap(response)));
  } catch (e) {
    throw toAuthError(e);
  }
};

// ─── Email verification (a link, as in the FYP app) ──
/**
 * Has the user opened the link we emailed? Polled by "I Verified My Email".
 * TODO(API_AUTH): confirm the path and response shape.
 */
export const authVerificationStatus = async (): Promise<boolean> => {
  try {
    const response = await api.get('/auth/verification-status');
    const body = unwrap(response);
    return body?.isEmailVerified === true || body?.verified === true;
  } catch (e) {
    throw toAuthError(e);
  }
};

/** The deep link's token: metromatrix://verify-success?token=… */
export const authVerifyEmail = async (token: string): Promise<User> => {
  try {
    const response = await api.post(AUTH_PATHS.verifyEmail, { token });
    const body = unwrap(response);
    return userSerializer(body?.user ?? body);
  } catch (e) {
    throw toAuthError(e);
  }
};

/** Resolves to the seconds until another resend is allowed. */
export const authResendVerification = async (): Promise<number> => {
  try {
    const response = await api.post('/auth/resend-verification');
    return retryAfterSerializer(unwrap(response));
  } catch (e) {
    throw toAuthError(e);
  }
};

// ─── Session ─────────────────────────────────────────
/**
 * The refresh call itself lives in apiHelpers: it must bypass the
 * interceptors it serves, and apiHelpers cannot import this module without a
 * cycle. Re-exported here so the auth surface is complete.
 */
export const authRefresh = refreshTokens;

export const authMe = async (): Promise<SessionPayload> => {
  try {
    const response = await api.get('/auth/me');
    const session = sessionSerializer(unwrap(response));
    if (!session) throw malformed();
    return session;
  } catch (e) {
    throw toAuthError(e);
  }
};

/**
 * Best-effort server revocation. Takes the token explicitly because sign-out
 * clears storage FIRST (so the UI never waits on the network) — the
 * interceptor would otherwise post an anonymous request. Never throws.
 */
export const authLogout = async (accessToken: string | null, refreshToken: string | null): Promise<void> => {
  if (!accessToken) return;
  try {
    await api.post(
      AUTH_PATHS.logout,
      refreshToken ? { refreshToken } : undefined,
      { timeout: 8000, headers: { Authorization: `Bearer ${accessToken}` } },
    );
  } catch {
    // The session is already gone locally.
  }
};

// ─── Password reset ──────────────────────────────────
export const authForgotPassword = async (email: string): Promise<number> => {
  try {
    const response = await api.post(AUTH_PATHS.forgotPassword, { email: email.trim().toLowerCase() });
    return retryAfterSerializer(unwrap(response));
  } catch (e) {
    throw toAuthError(e);
  }
};

export const authVerifyResetOtp = async (email: string, code: string): Promise<string> => {
  try {
    const response = await api.post(AUTH_PATHS.verifyResetOtp, { email: email.trim().toLowerCase(), code });
    const resetToken = unwrap(response)?.resetToken;
    if (typeof resetToken !== 'string' || !resetToken) throw malformed();
    return resetToken;
  } catch (e) {
    throw toAuthError(e);
  }
};

export const authResetPassword = async (resetToken: string, password: string): Promise<void> => {
  try {
    await api.post(AUTH_PATHS.resetPassword, { resetToken, password });
  } catch (e) {
    throw toAuthError(e);
  }
};

// ─── Account ─────────────────────────────────────────
/** `currentPassword` is omitted for Google-only accounts setting a first one. */
export const authChangePassword = async (payload: {
  currentPassword?: string;
  newPassword: string;
}): Promise<User> => {
  try {
    const response = await api.post('/auth/change-password', payload);
    const body = unwrap(response);
    return userSerializer(body?.user ?? body);
  } catch (e) {
    throw toAuthError(e);
  }
};

/** Deletes the account server-side, then clears the local tokens. */
export const authDeleteAccount = async (confirmation: { password: string } | { confirm: 'DELETE' }): Promise<void> => {
  try {
    await api.delete('/auth/account', { data: confirmation });
    await clearTokens();
  } catch (e) {
    throw toAuthError(e);
  }
};
