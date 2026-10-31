// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth calls: email verification (AUTH_CONTRACT.md)
// ═══════════════════════════════════════════════════════
// The API emails a link. Its web page (GET /auth/verify) or the app's deep
// link (metromatrix://verify-email?token=…) spends the token; the waiting
// screen notices by re-reading the account (me → user.isEmailVerified).

import { API, unwrap, toApiError, AUTH_PATHS } from '../network/network';
import { retryAfterSerializer, sessionSerializer, type SessionPayload } from '../../serializers/authSerializer';
import { malformed, withFullBusiness } from './session';

/**
 * Spend a link's token (public: the link may open the app signed out).
 * Resolves to the account the token belongs to. A spent link for an address
 * that IS verified succeeds too; only a link with work left can fail
 * (400 VERIFY_LINK_INVALID).
 */
export const verifyEmail = async (token: string): Promise<SessionPayload> => {
  try {
    const response = await API.POST({ URL: AUTH_PATHS.verifyEmail, data: { token: token.trim() } });
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
export const resendVerification = async (): Promise<ResendOutcome> => {
  try {
    const body = unwrap(await API.POST({ URL: '/auth/resend-verification' }));
    return { retryAfter: retryAfterSerializer(body), alreadyVerified: body?.alreadyVerified === true };
  } catch (e) {
    throw toApiError(e);
  }
};
