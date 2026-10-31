// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth calls: change password (AUTH_CONTRACT.md)
// ═══════════════════════════════════════════════════════

import { API, unwrap, setTokens, toApiError } from '../network/network';
import { tokensSerializer, type SessionPayload } from '../../serializers/authSerializer';
import { malformed } from './session';
import { me } from './me';

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
export const changePassword = async (payload: ChangePasswordPayload): Promise<SessionPayload> => {
  try {
    const body = unwrap(await API.POST({ URL: '/auth/change-password', data: payload }));
    const tokens = tokensSerializer(body);
    if (!tokens) throw malformed();
    await setTokens(tokens.accessToken, tokens.refreshToken);
    return await me();
  } catch (e) {
    throw toApiError(e);
  }
};
