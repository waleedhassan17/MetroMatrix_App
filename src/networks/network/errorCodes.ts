// ═══════════════════════════════════════════════════════
// MetroMatrix — Error codes (auth and session)
// ═══════════════════════════════════════════════════════
// The codes the app branches on, by the API's names
// (MetroMatrix_Backend src/common/errors/codes.ts), plus the few the app makes
// up itself. Compare against these constants, never a string typed inline, so
// a rename on either side fails the type check instead of silently not
// matching. `errorCopy` is what a person reads for each.

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
  /** A build with no backend URL (src/config/env.ts). */
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

type Details = Record<string, unknown> | null | undefined;

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.ceil(n) : null;
};

/** "45 seconds", "3 minutes". */
const wait = (seconds: number) =>
  seconds < 90 ? `${seconds} second${seconds === 1 ? '' : 's'}` : `${Math.ceil(seconds / 60)} minutes`;

/** Seconds to wait from `details.retryAfter` (the server, or the Retry-After header via toAuthError). */
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
