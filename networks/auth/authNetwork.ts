// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth Network (AUTH_CONTRACT.md)
// ═══════════════════════════════════════════════════════
// The session layer, as FinMatrix's authNetwork is: one function per /auth
// endpoint (and the first admin sign-in's TOTP enrolment). It is the one
// network that serializes: a function that opens a session stores the token
// pair HERE and answers the session, so a slice never touches storage or raw
// auth data. On failure each throws an ApiError carrying the server's code
// and details. Paths and bodies per MetroMatrix_Backend docs/API_AUTH.md.

import { api, unwrap, setTokens, clearTokens, refreshTokens, toApiError, ApiError, AUTH_PATHS, ERROR_CODES } from '../network/apiHelpers';
import { clearIntentionalSignOut } from '../../utils/auth-events/authEvents';
import { getAccessToken } from '../../utils/storage_utils/storageUtils';
import { getMyBusinessAPI } from '../businesses/businessNetwork';
import { businessSerializer } from '../../serializers/businessSerializer';
import {
  authResultSerializer,
  recoveryCodesSerializer,
  retryAfterSerializer,
  sessionSerializer,
  tokensSerializer,
  totpChallengeSerializer,
  totpEnrolmentSerializer,
  type SessionPayload,
} from '../../serializers/authSerializer';
import type { AuthResult, Portal, TotpChallenge, TotpEnrolment } from '../../models/auth';

// ─── Types ────────────────────────────────────────────
export interface SignupPayload {
  name: string;
  email: string;
  /** Canonical +92…, or '' when none was given (the field is then omitted). */
  phone: string;
  password: string;
  portal: Extract<Portal, 'customer' | 'partner'>;
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
  new ApiError('The server sent an unexpected response. Please try again.', ERROR_CODES.BAD_RESPONSE);

/** Store the pair and start a fresh session (riders included: their app is RiderNavigator). */
const openSession = async (result: AuthResult | null): Promise<AuthResult> => {
  if (!result) throw malformed();
  await setTokens(result.tokens.accessToken, result.tokens.refreshToken);
  // A new session starts: its 401s are real and must be handled.
  clearIntentionalSignOut();
  return result;
};

/**
 * The API's session (signin, /auth/me, verify-email) carries a partner's
 * business as a BusinessSummary: no address, pin, PMDC number or documents.
 * Setup, Rejected and the partner home need those, so for a partner the full
 * business (GET /businesses/me) replaces the summary. Best effort: on any
 * failure the summary stands. Only with a stored access token (a link opened
 * signed out must not set off a refresh), and only for the same business.
 */
const withFullBusiness = async <T extends SessionPayload>(session: T): Promise<T> => {
  if (session.user.role !== 'partner' || !session.business || !(await getAccessToken())) return session;
  try {
    const full = businessSerializer(await getMyBusinessAPI());
    // A Food vendor's brand (`food`) comes only with the session's summary.
    return full && full.id === session.business.id
      ? { ...session, business: { ...full, food: full.food ?? session.business.food } }
      : session;
  } catch {
    return session;
  }
};

// ─── Sign up / sign in ───────────────────────────────
/**
 * Exactly the API's SignupDto: `{ email, password, displayName, phone?, role }`.
 * A blank phone is left out rather than sent as ''. A provider's picked type
 * is not part of sign-up: it is kept by providerSelection and sent with the
 * business (POST /businesses).
 */
export const authSignup = async (payload: SignupPayload): Promise<AuthResult> => {
  try {
    const phone = payload.phone.trim();
    const response = await api.post(AUTH_PATHS.signup, {
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      displayName: payload.name.trim(),
      ...(phone ? { phone } : null),
      role: payload.portal,
    });
    return await openSession(authResultSerializer(unwrap(response)));
  } catch (e) {
    throw toApiError(e);
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
    return { kind: 'session', result: await withFullBusiness(await openSession(authResultSerializer(body))) };
  } catch (e) {
    throw toApiError(e);
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
    throw toApiError(e);
  }
};

/** Exchange a Google ID token (never an access token) for a session. */
export const authGoogle = async (idToken: string): Promise<AuthResult> => {
  try {
    // Google is the customer portal only; the API takes no `portal` here.
    const response = await api.post(AUTH_PATHS.google, { idToken });
    return await openSession(authResultSerializer(unwrap(response)));
  } catch (e) {
    throw toApiError(e);
  }
};

// ─── Email verification (a link, FinMatrix's flow) ───
// The API emails a link. Its web page (GET /auth/verify) or the app's deep
// link (metromatrix://verify-email?token=…) spends the token; the waiting
// screen notices by re-reading the account (authMe → user.isEmailVerified).

/**
 * Spend a link's token (public: the link may open the app signed out).
 * Resolves to the account the token belongs to. A spent link for an address
 * that IS verified succeeds too; only a link with work left can fail
 * (400 VERIFY_LINK_INVALID).
 */
export const authVerifyEmail = async (token: string): Promise<SessionPayload> => {
  try {
    const response = await api.post(AUTH_PATHS.verifyEmail, { token: token.trim() });
    const session = sessionSerializer(unwrap(response));
    if (!session) throw malformed();
    return await withFullBusiness(session);
  } catch (e) {
    throw toApiError(e);
  }
};

export interface ResendOutcome {
  /** Seconds until another resend is allowed. */
  retryAfter: number;
  /** The address was verified in the meantime: nothing was sent. */
  alreadyVerified: boolean;
}

/** 429 RESEND_COOLDOWN carries `details.retryAfter`. */
export const authResendVerification = async (): Promise<ResendOutcome> => {
  try {
    const body = unwrap(await api.post('/auth/resend-verification'));
    return { retryAfter: retryAfterSerializer(body), alreadyVerified: body?.alreadyVerified === true };
  } catch (e) {
    throw toApiError(e);
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
    return await withFullBusiness(session);
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * Best-effort server revocation. Takes the token explicitly because sign-out
 * clears storage FIRST (so the UI never waits on the network) — the
 * interceptor would otherwise post an anonymous request. No body: the API
 * revokes this device's whole session (refresh family included) from the
 * bearer, even an expired one. Never throws.
 */
export const authLogout = async (accessToken: string | null): Promise<void> => {
  if (!accessToken) return;
  try {
    await api.post(AUTH_PATHS.logout, undefined, {
      timeout: 8000,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // The session is already gone locally.
  }
};

// ─── Password reset ──────────────────────────────────
/**
 * Always `{ delivered: true }`, account or not (no enumeration), and with no
 * cooldown of its own: the app keeps a 60 s timer before offering Resend,
 * which simply calls this again. The route's throttle answers 429 RATE_LIMITED.
 */
export const authForgotPassword = async (email: string): Promise<void> => {
  try {
    await api.post(AUTH_PATHS.forgotPassword, { email: email.trim().toLowerCase() });
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * `{ email, otp }` → a single-use `resetToken`. OTP_INVALID carries
 * `details.attemptsLeft`; OTP_EXPIRED and OTP_LOCKED need a new code.
 */
export const authVerifyResetOtp = async (email: string, code: string): Promise<string> => {
  try {
    const response = await api.post(AUTH_PATHS.verifyResetOtp, {
      email: email.trim().toLowerCase(),
      otp: code.trim(),
    });
    const resetToken = unwrap(response)?.resetToken;
    if (typeof resetToken !== 'string' || !resetToken) throw malformed();
    return resetToken;
  } catch (e) {
    throw toApiError(e);
  }
};

export const authResetPassword = async (resetToken: string, password: string): Promise<void> => {
  try {
    await api.post(AUTH_PATHS.resetPassword, { resetToken, password });
  } catch (e) {
    throw toApiError(e);
  }
};

// ─── Account ─────────────────────────────────────────
/**
 * Proof for a password change: the current password, or for a Google-only
 * account a fresh Google ID token.
 */
export type ChangePasswordPayload =
  | { currentPassword: string; newPassword: string }
  | { idToken: string; newPassword: string };

/**
 * The API ends EVERY session at once (this one too) and answers
 * `{ changed, tokens }`: the new pair is stored before anything else, then
 * the account is re-read with it (`hasPassword` may have just turned true).
 * The whole session comes back, so the role and business are the server's,
 * never a stale or partial copy.
 */
export const authChangePassword = async (payload: ChangePasswordPayload): Promise<SessionPayload> => {
  try {
    const body = unwrap(await api.post('/auth/change-password', payload));
    const tokens = tokensSerializer(body);
    if (!tokens) throw malformed();
    await setTokens(tokens.accessToken, tokens.refreshToken);
    return await authMe();
  } catch (e) {
    throw toApiError(e);
  }
};

/** Deletes the account server-side, then clears the local tokens. */
/** `{ password }`, or for a Google-only account `{ idToken }` (a fresh one). */
export const authDeleteAccount = async (confirmation: { password: string } | { idToken: string }): Promise<void> => {
  try {
    await api.delete('/auth/account', { data: confirmation });
    await clearTokens();
  } catch (e) {
    throw toApiError(e);
  }
};

// ─── TOTP enrolment (first admin sign-in) ────────────
// Both run on the sign-in challenge token: the admin has no session yet. The
// API's AdminTotpEnrolGuard reads it as the bearer — never from the body.
// Enrol has no body; confirm sends only { code }. Confirm opens the session,
// so both live here with the other session openers.

const asChallenge = (challengeToken: string) => ({ headers: { Authorization: `Bearer ${challengeToken}` } });

/** `{ otpauthUri, qrDataUrl, secret }`; the app draws the QR from the URI. */
export const adminTotpEnrol = async (challengeToken: string): Promise<TotpEnrolment> => {
  try {
    const enrolment = totpEnrolmentSerializer(
      unwrap(await api.post(AUTH_PATHS.adminTotpEnrol, undefined, asChallenge(challengeToken))),
    );
    if (!enrolment) throw malformed();
    return enrolment;
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * Confirms the first code. Stores the session tokens now (they are real),
 * but the caller keeps the user on the recovery-codes step until they have
 * saved them — Redux only learns of the session after that.
 */
export const adminTotpConfirm = async (
  challengeToken: string,
  code: string,
): Promise<{ result: AuthResult; recoveryCodes: string[] }> => {
  try {
    const body = unwrap(await api.post(AUTH_PATHS.adminTotpConfirm, { code }, asChallenge(challengeToken)));
    // The API nests the session: { recoveryCodes, auth: AuthResult }.
    const result = authResultSerializer(body?.auth);
    if (!result) throw malformed();
    await setTokens(result.tokens.accessToken, result.tokens.refreshToken);
    clearIntentionalSignOut();
    return { result, recoveryCodes: recoveryCodesSerializer(body) };
  } catch (e) {
    throw toApiError(e);
  }
};
