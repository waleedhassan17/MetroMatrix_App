// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth Network
// ═══════════════════════════════════════════════════════
// One function per /auth endpoint. Each: call `api`, unwrap, serialize,
// and on failure throw an AuthError carrying the server's code + details.
// Functions that open a session store the token pair HERE (FinMatrix
// convention), so a slice never touches storage.
// Paths and bodies per MetroMatrix_Backend docs/API_AUTH.md; `forMock` keeps
// the dummy API (assumed contract) working until it is brought in line.

import {
  api,
  unwrap,
  setTokens,
  clearTokens,
  refreshTokens,
  toAuthError,
  forMock,
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
import { isObject } from '../../serializers/serializerUtils';
import { SUBTYPE_SERVICE } from '../../models/businessModel';
import type { AuthResult, Portal, SubType, TotpChallenge, User } from '../../types/auth';

// ─── Types ────────────────────────────────────────────
export interface SignupPayload {
  name: string;
  email: string;
  /** Canonical +92…, or '' when none was given (the field is then omitted). */
  phone: string;
  password: string;
  portal: Extract<Portal, 'customer' | 'partner'>;
  /** Providers: the type picked on Provider Selection. */
  subType?: SubType;
}

export interface SigninPayload {
  email: string;
  password: string;
  portal: Portal;
}

export type SigninOutcome =
  | { kind: 'session'; result: AuthResult }
  | { kind: 'totp'; challenge: TotpChallenge };

// ─── Session helpers ─────────────────────────────────
const malformed = () =>
  new AuthError('The server sent an unexpected response. Please try again.', 'BAD_RESPONSE');

/**
 * Store the pair and start a fresh session. Rider accounts are refused
 * BEFORE anything is stored (FinMatrix's WRONG_APP pattern): they have no app
 * here, and there is no session to clean up if it never began.
 */
const openSession = async (result: AuthResult | null): Promise<AuthResult> => {
  if (!result) throw malformed();
  if (result.user.role === 'rider') {
    throw new AuthError('Rider accounts sign in through the MetroMatrix Rider app.', 'WRONG_APP');
  }
  await setTokens(result.tokens.accessToken, result.tokens.refreshToken);
  // A new session starts: its 401s are real and must be handled.
  clearIntentionalSignOut();
  return result;
};

// ─── Sign up / sign in ───────────────────────────────
/**
 * The API takes `displayName` and `role` (`customer` | `partner`); `phone` is
 * optional, so a blank one is left out rather than sent as ''.
 */
export const authSignup = async (payload: SignupPayload): Promise<AuthResult> => {
  try {
    const name = payload.name.trim();
    const phone = payload.phone.trim();
    const response = await api.post(AUTH_PATHS.signup, {
      displayName: name,
      email: payload.email.trim().toLowerCase(),
      ...(phone ? { phone } : null),
      password: payload.password,
      role: payload.portal,
      ...forMock({}, { name, portal: payload.portal, subType: payload.subType, acceptedTerms: true }),
    });
    return await openSession(withPickedSubType(authResultSerializer(unwrap(response)), payload.subType));
  } catch (e) {
    throw toAuthError(e);
  }
};

/**
 * The API doesn't keep the type picked on Provider Selection: it arrives with
 * the business (POST /businesses). Until then PersonalInfo reads it from the
 * user, so the pick is carried onto the new session here.
 */
const withPickedSubType = (result: AuthResult | null, subType?: SubType): AuthResult | null => {
  if (!result || !subType || result.user.providerSubType) return result;
  return {
    ...result,
    user: { ...result.user, providerSubType: subType, providerServiceType: SUBTYPE_SERVICE[subType] },
  };
};

/**
 * Customer and partner portals return a session; the admin portal returns a
 * TOTP challenge and NO tokens — nothing is stored until the second factor.
 */
export const authSignin = async (payload: SigninPayload): Promise<SigninOutcome> => {
  try {
    const response = await api.post(AUTH_PATHS.signin, {
      email: payload.email.trim().toLowerCase(),
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
    // Google is the customer portal only; the API takes no `portal` here.
    const response = await api.post(AUTH_PATHS.google, { idToken });
    return await openSession(authResultSerializer(unwrap(response)));
  } catch (e) {
    throw toAuthError(e);
  }
};

// ─── Email verification ──────────────────────────────
// The API emails a 6-digit code (POST /auth/verify-email { otp }); it has no
// link and no status endpoint. The dummy API still models the FYP's link.

/**
 * Is the address verified yet? Polled by "I Verified My Email". The API's
 * answer is the account itself (GET /auth/me → user.isEmailVerified).
 */
export const authVerificationStatus = async (): Promise<boolean> => {
  try {
    const response = await api.get(forMock('/auth/me', '/auth/verification-status'));
    const body = unwrap(response);
    const source = body?.user ?? body;
    return source?.isEmailVerified === true || source?.verified === true;
  } catch (e) {
    throw toAuthError(e);
  }
};

/** The emailed 6-digit code (the dummy API: the deep link's token). */
export const authVerifyEmail = async (code: string): Promise<User> => {
  try {
    const response = await api.post(AUTH_PATHS.verifyEmail, forMock({ otp: code.trim() }, { token: code }));
    const body = unwrap(response);
    return userSerializer(body?.user ?? body);
  } catch (e) {
    throw toAuthError(e);
  }
};

/**
 * Resolves to the seconds until another resend is allowed. The API's cooldown
 * (429 RESEND_COOLDOWN, `details.retryAfter`) is reported as the app's
 * RESEND_TOO_SOON.
 */
export const authResendVerification = async (): Promise<number> => {
  try {
    const response = await api.post('/auth/resend-verification');
    return retryAfterSerializer(unwrap(response));
  } catch (e) {
    throw asResendTooSoon(toAuthError(e));
  }
};

const asResendTooSoon = (e: AuthError): AuthError =>
  e.code === 'RESEND_COOLDOWN' ? new AuthError(e.message, 'RESEND_TOO_SOON', e.status, e.details) : e;

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
    const response = await api.post(AUTH_PATHS.verifyResetOtp, {
      email: email.trim().toLowerCase(),
      ...forMock<{ otp: string } | { code: string }>({ otp: code.trim() }, { code }),
    });
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
/**
 * `currentPassword` is omitted for Google-only accounts setting a first one.
 * The API answers `{ changed: true }`, not the user, so the account is re-read
 * (its `hasPassword` may have just turned true).
 */
export const authChangePassword = async (payload: {
  currentPassword?: string;
  newPassword: string;
}): Promise<User> => {
  try {
    const response = await api.post('/auth/change-password', payload);
    const body = unwrap(response);
    if (isObject(body?.user)) return userSerializer(body.user);
    return (await authMe()).user;
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
