// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Network (partner approvals + TOTP enrolment)
// ═══════════════════════════════════════════════════════
// TODO(API_AUTH): paths and bodies per docs/API_CONTRACT_ASSUMED.md.

import { api, unwrap, setTokens, toAuthError, AuthError } from '../network/apiHelpers';
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

const malformed = () => new AuthError('The server sent an unexpected response.', 'BAD_RESPONSE');

const toBusiness = (raw: unknown): Business => {
  const business = businessSerializer(raw);
  if (!business) throw malformed();
  return business;
};

// ─── Approval queue ──────────────────────────────────
export const listBusinesses = async (query: {
  status?: BusinessStatus;
  serviceType?: ServiceType;
  cursor?: string | null;
}): Promise<{ items: BusinessSummary[]; nextCursor: string | null }> => {
  try {
    const response = await api.get('/admin/businesses', {
      params: {
        status: query.status ?? 'pending_approval',
        serviceType: query.serviceType,
        cursor: query.cursor ?? undefined,
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
  body: { reason: string; documentNotes: Record<string, string> },
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

export const reinstateBusiness = async (id: string): Promise<Business> => {
  try {
    return toBusiness(unwrap(await api.post(`/admin/businesses/${encodeURIComponent(id)}/reinstate`)));
  } catch (e) {
    throw toAuthError(e);
  }
};

// ─── TOTP enrolment (first admin sign-in) ────────────
// Both run on the sign-in challenge token: the admin has no session yet.

export const adminTotpEnrol = async (challengeToken: string): Promise<TotpEnrolment> => {
  try {
    const enrolment = totpEnrolmentSerializer(unwrap(await api.post('/auth/admin/totp/enrol', { challengeToken })));
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
    const body = unwrap(await api.post('/auth/admin/totp/confirm', { challengeToken, code }));
    const result = authResultSerializer(body);
    if (!result) throw malformed();
    await setTokens(result.tokens.accessToken, result.tokens.refreshToken);
    clearIntentionalSignOut();
    return { result, recoveryCodes: recoveryCodesSerializer(body) };
  } catch (e) {
    throw toAuthError(e);
  }
};
