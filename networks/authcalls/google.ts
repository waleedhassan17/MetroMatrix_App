// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth calls: Google sign-in (AUTH_CONTRACT.md)
// ═══════════════════════════════════════════════════════

import { API, unwrap, toApiError, AUTH_PATHS } from '../network/network';
import { authResultSerializer } from '../../serializers/authSerializer';
import { openSession } from './session';
import type { AuthResult } from '../../models/auth';

/** Exchange a Google ID token (never an access token) for a session. */
export const authGoogle = async (idToken: string): Promise<AuthResult> => {
  try {
    // Google is the customer portal only; the API takes no `portal` here.
    const response = await API.POST({ URL: AUTH_PATHS.google, data: { idToken } });
    return await openSession(authResultSerializer(unwrap(response)));
  } catch (e) {
    throw toApiError(e);
  }
};
