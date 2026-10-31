// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth calls: sign up (AUTH_CONTRACT.md)
// ═══════════════════════════════════════════════════════

import { API, unwrap, toApiError, AUTH_PATHS } from '../network/network';
import { authResultSerializer } from '../../serializers/authSerializer';
import { openSession } from './session';
import type { AuthResult, Portal } from '../../models/auth';

export interface SignupPayload {
  name: string;
  email: string;
  /** Canonical +92…, or '' when none was given (the field is then omitted). */
  phone: string;
  password: string;
  portal: Extract<Portal, 'customer' | 'partner'>;
}

/**
 * Exactly the API's SignupDto: `{ email, password, displayName, phone?, role }`.
 * A blank phone is left out rather than sent as ''. A provider's picked type
 * is not part of sign-up: it is kept by providerSelection and sent with the
 * business (POST /businesses).
 */
export const authSignup = async (payload: SignupPayload): Promise<AuthResult> => {
  try {
    const phone = payload.phone.trim();
    const response = await API.POST({
      URL: AUTH_PATHS.signup,
      data: {
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
        displayName: payload.name.trim(),
        ...(phone ? { phone } : null),
        role: payload.portal,
      },
    });
    return await openSession(authResultSerializer(unwrap(response)));
  } catch (e) {
    throw toApiError(e);
  }
};
