// ═══════════════════════════════════════════════════════
// MetroMatrix — Business Network (partner's own business)
// ═══════════════════════════════════════════════════════
// Paths and bodies per MetroMatrix_Backend businesses.controller.ts and
// dto/business.dto.ts (partners with a verified email).

import { api, unwrap, toAuthError, AuthError } from '../network/apiHelpers';
import { businessSerializer, businessStatusSerializer } from '../../serializers/businessSerializer';
import type { Business, BusinessStatusInfo, DocumentKind, ServiceType, SubType } from '../../types/auth';
import { ERROR_CODES } from '../network/errorCodes';

/** The API's CreateBusinessDto (PATCH takes any part of it). Unknown fields are dropped by the API. */
export interface BusinessPayload {
  serviceType: ServiceType;
  subType: SubType;
  name: string;
  phone: string;
  city: string;
  addressLine: string;
  lat?: number;
  lng?: number;
  /** Doctors only. */
  pmdcNumber?: string;
}

const toBusiness = (raw: unknown): Business => {
  const business = businessSerializer(raw);
  if (!business) throw new AuthError('The server sent an unexpected business record.', ERROR_CODES.BAD_RESPONSE);
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

/**
 * Records an uploaded file: `{ kind, url, publicId }`, the URL and id
 * Cloudinary returned for an upload signed for `business_document`. A
 * single-copy kind replaces the earlier one; kitchen and shop photos add up
 * (at most 4). The API answers the one document (DocumentView), so the
 * business is read again for the new list and requirement statuses.
 */
export const addDocument = async (doc: { kind: DocumentKind; url: string; publicId: string }): Promise<Business> => {
  try {
    const { kind, url, publicId } = doc;
    await api.post('/businesses/me/documents', { kind, url, publicId });
    return toBusiness(unwrap(await api.get('/businesses/me')));
  } catch (e) {
    throw toAuthError(e);
  }
};

/**
 * DELETE answers `{ removed: true }`, not the business, so the business is
 * read again for the new document list.
 */
export const removeDocument = async (documentId: string): Promise<Business> => {
  try {
    await api.delete(`/businesses/me/documents/${encodeURIComponent(documentId)}`);
    return toBusiness(unwrap(await api.get('/businesses/me')));
  } catch (e) {
    throw toAuthError(e);
  }
};

/** 422 DOCUMENTS_MISSING carries `details.missing`: requirement keys (`kind` or `a|b`). */
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
    if (!info) throw new AuthError('The server sent an unexpected status.', ERROR_CODES.BAD_RESPONSE);
    return info;
  } catch (e) {
    throw toAuthError(e);
  }
};
