// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Network (partner approvals + TOTP enrolment)
// ═══════════════════════════════════════════════════════
// Paths and bodies per MetroMatrix_Backend admin.controller.ts and
// admin/dto (RejectBusinessDto, ReasonDto, AdminBusinessQueryDto).

import { api, unwrap, setTokens, toAuthError, AuthError, AUTH_PATHS } from '../network/apiHelpers';
import { clearIntentionalSignOut } from '../../utils/authEvents';
import {
  businessPageSerializer,
  businessSerializer,
  businessWithOwnerSerializer,
} from '../../serializers/businessSerializer';
import {
  authResultSerializer,
  recoveryCodesSerializer,
  totpEnrolmentSerializer,
} from '../../serializers/authSerializer';
import type {
  AuthResult,
  Business,
  BusinessStatus,
  BusinessSummary,
  BusinessWithOwner,
  ServiceType,
  TotpEnrolment,
} from '../../types/auth';
import { ERROR_CODES } from '../network/errorCodes';

const malformed = () => new AuthError('The server sent an unexpected response.', ERROR_CODES.BAD_RESPONSE);

const toBusiness = (raw: unknown): Business => {
  const business = businessSerializer(raw);
  if (!business) throw malformed();
  return business;
};

// ─── Approval queue ──────────────────────────────────
const PAGE_SIZE = 20;

/**
 * The API pages by number (`page`, `pageSize`, optional `q`) and answers
 * `{ items, total, page, pageSize }`; the queue keeps its "load more" cursor,
 * which here is the next page number.
 */
export const listBusinesses = async (query: {
  status?: BusinessStatus;
  serviceType?: ServiceType;
  q?: string;
  cursor?: string | null;
}): Promise<{ items: BusinessSummary[]; nextCursor: string | null }> => {
  try {
    const page = Math.max(1, Number(query.cursor) || 1);
    const response = await api.get('/admin/businesses', {
      params: {
        status: query.status ?? 'pending_approval',
        serviceType: query.serviceType,
        q: query.q?.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
      },
    });
    return businessPageSerializer(unwrap(response));
  } catch (e) {
    throw toAuthError(e);
  }
};

export const getBusiness = async (id: string): Promise<BusinessWithOwner> => {
  try {
    const business = businessWithOwnerSerializer(unwrap(await api.get(`/admin/businesses/${encodeURIComponent(id)}`)));
    if (!business) throw malformed();
    return business;
  } catch (e) {
    throw toAuthError(e);
  }
};

export const approveBusiness = async (id: string): Promise<Business> => {
  try {
    return toBusiness(unwrap(await api.post(`/admin/businesses/${encodeURIComponent(id)}/approve`)));
  } catch (e) {
    throw toAuthError(e);
  }
};

export const rejectBusiness = async (
  id: string,
  body: { reason: string; documentNotes: { documentId: string; note: string }[] },
): Promise<Business> => {
  try {
    return toBusiness(unwrap(await api.post(`/admin/businesses/${encodeURIComponent(id)}/reject`, body)));
  } catch (e) {
    throw toAuthError(e);
  }
};

export const suspendBusiness = async (id: string, reason: string): Promise<Business> => {
  try {
    return toBusiness(unwrap(await api.post(`/admin/businesses/${encodeURIComponent(id)}/suspend`, { reason })));
  } catch (e) {
    throw toAuthError(e);
  }
};

/** The API's ReasonDto: a reason (3–1000) is required, as for suspend. */
export const reinstateBusiness = async (id: string, reason: string): Promise<Business> => {
  try {
    return toBusiness(unwrap(await api.post(`/admin/businesses/${encodeURIComponent(id)}/reinstate`, { reason })));
  } catch (e) {
    throw toAuthError(e);
  }
};

// ─── TOTP enrolment (first admin sign-in) ────────────
// Both run on the sign-in challenge token: the admin has no session yet. The
// API's AdminTotpEnrolGuard reads it as the bearer — never from the body.
// Enrol has no body; confirm sends only { code }.

const asChallenge = (challengeToken: string) => ({ headers: { Authorization: `Bearer ${challengeToken}` } });

/** `{ otpauthUri, qrDataUrl, secret }`; the app draws the QR from the URI. */
export const adminTotpEnrol = async (challengeToken: string): Promise<TotpEnrolment> => {
  try {
    const enrolment = totpEnrolmentSerializer(
      unwrap(await api.post(AUTH_PATHS.adminTotpEnrol, undefined, asChallenge(challengeToken))),
    );
    if (!enrolment) throw malformed();
    return enrolment;
  } catch (e) {
    throw toAuthError(e);
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
    const body = unwrap(await api.post(AUTH_PATHS.adminTotpConfirm, { code }, asChallenge(challengeToken)));
    // The API nests the session: { recoveryCodes, auth: AuthResult }.
    const result = authResultSerializer(body?.auth);
    if (!result) throw malformed();
    await setTokens(result.tokens.accessToken, result.tokens.refreshToken);
    clearIntentionalSignOut();
    return { result, recoveryCodes: recoveryCodesSerializer(body) };
  } catch (e) {
    throw toAuthError(e);
  }
};
