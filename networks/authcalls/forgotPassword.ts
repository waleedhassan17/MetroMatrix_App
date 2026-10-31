// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth calls: password reset (AUTH_CONTRACT.md)
// ═══════════════════════════════════════════════════════
// Forgot password → a 6-digit code by email → verify it for a reset token →
// set the new password.

import { API, unwrap, toApiError, AUTH_PATHS } from '../network/network';
import { malformed } from './session';

/**
 * Always `{ delivered: true }`, account or not (no enumeration), and with no
 * cooldown of its own: the app keeps a 60 s timer before offering Resend,
 * which simply calls this again. The route's throttle answers 429 RATE_LIMITED.
 */
export const forgotPassword = async (email: string): Promise<void> => {
  try {
    await API.POST({ URL: AUTH_PATHS.forgotPassword, data: { email: email.trim().toLowerCase() } });
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * `{ email, otp }` → a single-use `resetToken`. OTP_INVALID carries
 * `details.attemptsLeft`; OTP_EXPIRED and OTP_LOCKED need a new code.
 */
export const verifyResetOtp = async (email: string, code: string): Promise<string> => {
  try {
    const response = await API.POST({
      URL: AUTH_PATHS.verifyResetOtp,
      data: { email: email.trim().toLowerCase(), otp: code.trim() },
    });
    const resetToken = unwrap(response)?.resetToken;
    if (typeof resetToken !== 'string' || !resetToken) throw malformed();
    return resetToken;
  } catch (e) {
    throw toApiError(e);
  }
};

export const resetPassword = async (resetToken: string, password: string): Promise<void> => {
  try {
    await API.POST({ URL: AUTH_PATHS.resetPassword, data: { resetToken, password } });
  } catch (e) {
    throw toApiError(e);
  }
};
