// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Business Network (AUTH_CONTRACT.md)
// ═══════════════════════════════════════════════════════
// Partner approvals. Paths and bodies per MetroMatrix_Backend
// admin.controller.ts and admin/dto (RejectBusinessDto, ReasonDto,
// AdminBusinessQueryDto). The first admin sign-in's TOTP enrolment opens a
// session, so it lives with the session layer (auth/authNetwork.ts).

import { api, toApiError } from '../network/apiHelpers';
import type { BusinessStatus, ServiceType } from '../../models/auth';

// ─── Query Params ────────────────────────────────────

/** The API's AdminBusinessQueryDto: pages by number; answers `{ items, total, page, pageSize }`. */
export interface AdminBusinessQueryParams {
  status?: BusinessStatus;
  serviceType?: ServiceType;
  q?: string;
  page?: number;
  pageSize?: number;
}

// ═══════════════════════════════════════════════════════
// API Functions
// ═══════════════════════════════════════════════════════

export const getBusinessesAPI = async (params: AdminBusinessQueryParams): Promise<unknown> => {
  try {
    const response = await api.get('/admin/businesses', { params });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getBusinessAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`/admin/businesses/${encodeURIComponent(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const approveBusinessAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.post(`/admin/businesses/${encodeURIComponent(id)}/approve`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const rejectBusinessAPI = async (
  id: string,
  body: { reason: string; documentNotes: { documentId: string; note: string }[] },
): Promise<unknown> => {
  try {
    const response = await api.post(`/admin/businesses/${encodeURIComponent(id)}/reject`, body);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const suspendBusinessAPI = async (id: string, reason: string): Promise<unknown> => {
  try {
    const response = await api.post(`/admin/businesses/${encodeURIComponent(id)}/suspend`, { reason });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The API's ReasonDto: a reason (3–1000) is required, as for suspend. */
export const reinstateBusinessAPI = async (id: string, reason: string): Promise<unknown> => {
  try {
    const response = await api.post(`/admin/businesses/${encodeURIComponent(id)}/reinstate`, { reason });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
