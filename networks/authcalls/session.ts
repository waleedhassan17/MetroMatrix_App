// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth calls: the session they open (AUTH_CONTRACT.md)
// ═══════════════════════════════════════════════════════
// networks/authcalls/ is the session layer, one file per /auth call as in
// Consultant_Mobile (signin.ts, signup.ts, me.ts, logout.ts …). It is the one
// part of the network layer that serializes: a call that opens a session
// stores the token pair HERE and answers the session, so a slice never
// touches storage or raw auth data. On failure each call throws an ApiError
// carrying the server's code and details. Paths and bodies per
// MetroMatrix_Backend docs/API_AUTH.md.

import { setTokens, ApiError, ERROR_CODES } from '../network/network';
import { clearIntentionalSignOut } from '../../utils/auth-events/authEvents';
import { getAccessToken } from '../../utils/storage_utils/storageUtils';
import { fetchMyBusiness } from '../businesses/business';
import { businessSerializer } from '../../serializers/businessSerializer';
import type { SessionPayload } from '../../serializers/authSerializer';
import type { AuthResult } from '../../models/auth';

export const malformed = () =>
  new ApiError('The server sent an unexpected response. Please try again.', ERROR_CODES.BAD_RESPONSE);

/** Store the pair and start a fresh session (riders included: their app is RiderNavigator). */
export const openSession = async (result: AuthResult | null): Promise<AuthResult> => {
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
export const withFullBusiness = async <T extends SessionPayload>(session: T): Promise<T> => {
  if (session.user.role !== 'partner' || !session.business || !(await getAccessToken())) return session;
  try {
    const full = businessSerializer(await fetchMyBusiness());
    // A Food vendor's brand (`food`) comes only with the session's summary.
    return full && full.id === session.business.id
      ? { ...session, business: { ...full, food: full.food ?? session.business.food } }
      : session;
  } catch {
    return session;
  }
};
