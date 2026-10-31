// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth calls: the admin's second factor (AUTH_CONTRACT.md)
// ═══════════════════════════════════════════════════════
// Staff sign in with a TOTP after the password. On a first sign-in they enrol
// first: enrol and confirm run on the sign-in challenge token, because the
// admin has no session yet. The API's AdminTotpEnrolGuard reads it as the
// bearer, never from the body. Enrol has no body; confirm sends only { code }.

import { API, unwrap, setTokens, toApiError, AUTH_PATHS } from '../network/network';
import { clearIntentionalSignOut } from '../../utils/auth-events/authEvents';
import { authResultSerializer, recoveryCodesSerializer, totpEnrolmentSerializer } from '../../serializers/authSerializer';
import { malformed, openSession } from './session';
import type { AuthResult, TotpEnrolment } from '../../models/auth';

/** Second factor: a 6-digit TOTP code or a single-use recovery code. */
export const authAdminTotp = async (
  challengeToken: string,
  factor: { code: string } | { recoveryCode: string },
): Promise<AuthResult> => {
  try {
    const response = await API.POST({ URL: AUTH_PATHS.adminTotp, data: { challengeToken, ...factor } });
    return await openSession(authResultSerializer(unwrap(response)));
  } catch (e) {
    throw toApiError(e);
  }
};

const asChallenge = (challengeToken: string) => ({ headers: { Authorization: `Bearer ${challengeToken}` } });

/** `{ otpauthUri, qrDataUrl, secret }`; the app draws the QR from the URI. */
export const adminTotpEnrol = async (challengeToken: string): Promise<TotpEnrolment> => {
  try {
    const enrolment = totpEnrolmentSerializer(
      unwrap(await API.POST({ URL: AUTH_PATHS.adminTotpEnrol, ...asChallenge(challengeToken) })),
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
    const body = unwrap(await API.POST({ URL: AUTH_PATHS.adminTotpConfirm, data: { code }, ...asChallenge(challengeToken) }));
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
