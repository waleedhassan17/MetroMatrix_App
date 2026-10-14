// ═══════════════════════════════════════════════════════
// MetroMatrix — Business Network (partner's own business)
// ═══════════════════════════════════════════════════════
// TODO(API_AUTH): paths and bodies per docs/API_CONTRACT_ASSUMED.md.

import { api, unwrap, toAuthError, AuthError } from '../network/apiHelpers';
import { businessSerializer, businessStatusSerializer } from '../../serializers/businessSerializer';
import type { Business, BusinessStatusInfo, DocumentKind, GeoPoint, ServiceType, SubType } from '../../types/auth';

export interface BusinessPayload {
  serviceType: ServiceType;
  subType: SubType;
  name: string;
  phone: string;
  city: string;
  address: string;
  location: GeoPoint | null;
  details: Record<string, string>;
}

const toBusiness = (raw: unknown): Business => {
  const business = businessSerializer(raw);
  if (!business) throw new AuthError('The server sent an unexpected business record.', 'BAD_RESPONSE');
  return business;
};

export const createBusiness = async (payload: BusinessPayload): Promise<Business> => {
  try {
    return toBusiness(unwrap(await api.post('/businesses', payload)));
  } catch (e) {
    throw toAuthError(e);
  }
};

/** null when the partner has not created one yet (404). */
export const getMyBusiness = async (): Promise<Business | null> => {
  try {
    return toBusiness(unwrap(await api.get('/businesses/me')));
  } catch (e) {
    const err = toAuthError(e);
    if (err.status === 404) return null;
    throw err;
  }
};

export const updateMyBusiness = async (patch: Partial<BusinessPayload>): Promise<Business> => {
  try {
    return toBusiness(unwrap(await api.patch('/businesses/me', patch)));
  } catch (e) {
    throw toAuthError(e);
  }
};

/** Records an uploaded file; replaces any earlier document of that kind. */
export const addDocument = async (doc: {
  kind: DocumentKind;
  url: string;
  publicId: string;
  mimeType: string;
}): Promise<Business> => {
  try {
    return toBusiness(unwrap(await api.post('/businesses/me/documents', doc)));
  } catch (e) {
    throw toAuthError(e);
  }
};

export const removeDocument = async (documentId: string): Promise<Business> => {
  try {
    return toBusiness(unwrap(await api.delete(`/businesses/me/documents/${encodeURIComponent(documentId)}`)));
  } catch (e) {
    throw toAuthError(e);
  }
};

/** 422 DOCUMENTS_MISSING carries `details.missing: DocumentKind[]`. */
export const submitBusiness = async (): Promise<Business> => {
  try {
    return toBusiness(unwrap(await api.post('/businesses/me/submit')));
  } catch (e) {
    throw toAuthError(e);
  }
};

export const getMyBusinessStatus = async (): Promise<BusinessStatusInfo> => {
  try {
    const info = businessStatusSerializer(unwrap(await api.get('/businesses/me/status')));
    if (!info) throw new AuthError('The server sent an unexpected status.', 'BAD_RESPONSE');
    return info;
  } catch (e) {
    throw toAuthError(e);
  }
};
