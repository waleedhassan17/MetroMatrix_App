// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth calls: sign in (AUTH_CONTRACT.md)
// ═══════════════════════════════════════════════════════

import { API, unwrap, refreshTokens, toApiError, AUTH_PATHS } from '../network/network';
import { authResultSerializer, totpChallengeSerializer } from '../../serializers/authSerializer';
import { openSession, withFullBusiness } from './session';
import type { AuthResult, Portal, TotpChallenge } from '../../models/auth';

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

/**
 * Customer and partner portals return a session; the admin portal returns a
 * TOTP challenge and NO tokens — nothing is stored until the second factor
 * (adminTotp.ts).
 */
export const authLogin = async (payload: SigninPayload): Promise<SigninOutcome> => {
  try {
    const response = await API.POST({
      URL: AUTH_PATHS.signin,
      data: {
        // Riders sign in with a username (`identifier`, MetroMatrix-API API_AUTH.md).
        ...(payload.username !== undefined
          ? { identifier: payload.username.trim().toLowerCase() }
          : { email: (payload.email ?? '').trim().toLowerCase() }),
        password: payload.password,
        portal: payload.portal,
      },
    });
    const body = unwrap(response);
    const challenge = totpChallengeSerializer(body);
    if (challenge) return { kind: 'totp', challenge };
    return { kind: 'session', result: await withFullBusiness(await openSession(authResultSerializer(body))) };
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * The refresh call itself lives in network.ts: it must bypass the
 * interceptors it serves, and network.ts cannot import this module without a
 * cycle. Re-exported here so the sign-in surface is complete.
 */
export const refreshAccessToken = refreshTokens;
