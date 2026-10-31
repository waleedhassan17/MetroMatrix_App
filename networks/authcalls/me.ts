// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth calls: the signed-in account (AUTH_CONTRACT.md)
// ═══════════════════════════════════════════════════════

import { API, unwrap, toApiError } from '../network/network';
import { sessionSerializer, type SessionPayload } from '../../serializers/authSerializer';
import { malformed, withFullBusiness } from './session';

/** GET /auth/me: the account, its role and (for a partner) the full business. */
export const me = async (): Promise<SessionPayload> => {
  try {
    const response = await API.GET({ URL: '/auth/me' });
    const session = sessionSerializer(unwrap(response));
    if (!session) throw malformed();
    return await withFullBusiness(session);
  } catch (e) {
    throw toApiError(e);
  }
};
