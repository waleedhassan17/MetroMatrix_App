// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Business Network (AUTH_CONTRACT.md)
// ═══════════════════════════════════════════════════════
// Partner approvals. Paths and bodies per MetroMatrix_Backend
// admin.controller.ts and admin/dto (RejectBusinessDto, ReasonDto,
// AdminBusinessQueryDto). The first admin sign-in's TOTP enrolment opens a
// session, so it lives with the session layer (authcalls/).

import { API, toApiError } from '../network/network';
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

export const fetchBusinesses = async (params: AdminBusinessQueryParams): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/admin/businesses', params });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchBusiness = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/admin/businesses/${encodeURIComponent(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const approveBusiness = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/admin/businesses/${encodeURIComponent(id)}/approve` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const rejectBusiness = async (
  id: string,
  body: { reason: string; documentNotes: { documentId: string; note: string }[] },
): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/admin/businesses/${encodeURIComponent(id)}/reject`, data: body });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const suspendBusiness = async (id: string, reason: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/admin/businesses/${encodeURIComponent(id)}/suspend`, data: { reason } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The API's ReasonDto: a reason (3–1000) is required, as for suspend. */
export const reinstateBusiness = async (id: string, reason: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/admin/businesses/${encodeURIComponent(id)}/reinstate`, data: { reason } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
