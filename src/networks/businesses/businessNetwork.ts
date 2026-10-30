// ═══════════════════════════════════════════════════════
// MetroMatrix — Businesses Network (AUTH_CONTRACT.md)
// ═══════════════════════════════════════════════════════
// The partner's own business. Paths and bodies per MetroMatrix_Backend
// businesses.controller.ts and dto/business.dto.ts (partners with a verified
// email).

import { api, toApiError } from '../network/apiHelpers';
import type { DocumentKind, ServiceType, SubType } from '../../types/auth';

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

export const createBusinessAPI = async (payload: BusinessPayload): Promise<unknown> => {
  try {
    const response = await api.post('/businesses', payload);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** 404 (status) when the partner has not created one yet. */
export const getMyBusinessAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/businesses/me');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateMyBusinessAPI = async (patch: Partial<BusinessPayload>): Promise<unknown> => {
  try {
    const response = await api.patch('/businesses/me', patch);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * Records an uploaded file: `{ kind, url, publicId }`, the URL and id
 * Cloudinary returned for an upload signed for `business_document`. A
 * single-copy kind replaces the earlier one; kitchen and shop photos add up
 * (at most 4). Answers the one document (DocumentView), so the caller reads
 * the business again for the new list and requirement statuses.
 */
export const addDocumentAPI = async (doc: { kind: DocumentKind; url: string; publicId: string }): Promise<unknown> => {
  try {
    const { kind, url, publicId } = doc;
    const response = await api.post('/businesses/me/documents', { kind, url, publicId });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Answers `{ removed: true }`, not the business: the caller reads it again. */
export const removeDocumentAPI = async (documentId: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/businesses/me/documents/${encodeURIComponent(documentId)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** 422 DOCUMENTS_MISSING carries `details.missing`: requirement keys (`kind` or `a|b`). */
export const submitBusinessAPI = async (): Promise<unknown> => {
  try {
    const response = await api.post('/businesses/me/submit');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getMyBusinessStatusAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/businesses/me/status');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
