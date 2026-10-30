// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Growth Catering Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Catering ("Plan a dawat"), for customers and the kitchen.
// docs/API_KITCHEN_ASSUMED.md §2.10, §3.10, §4.6 (TODO(API_KITCHEN): an assumed contract).

import { api, toApiError, clean } from '../network/apiHelpers';
import type { CateringRequestInput, CateringSettings, QuoteInput } from '../../types/kitchen';

const enc = encodeURIComponent;

// ── Customers ──
/** What a kitchen takes, and its menu to choose from (by brand id or slug). */
export const getCateringVendorAPI = async (vendor: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/catering/vendors/${enc(vendor)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const requestCateringAPI = async (input: CateringRequestInput): Promise<unknown> => {
  try {
    const response = await api.post('/food/catering/requests', clean({ ...input }));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getMyCateringRequestsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/catering/requests');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getMyCateringRequestAPI = async (code: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/catering/requests/${enc(code)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const acceptQuoteAPI = async (code: string, version: number): Promise<unknown> => {
  try {
    const response = await api.post(`/food/catering/requests/${enc(code)}/quotes/${version}/accept`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const submitAdvanceProofAPI = async (code: string, input: { transactionId: string; imageUrl: string | null }): Promise<unknown> => {
  try {
    const response = await api.post(`/food/catering/requests/${enc(code)}/advance-proof`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const cancelMyCateringAPI = async (code: string, reason?: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/catering/requests/${enc(code)}/cancel`, clean({ reason }));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── The kitchen ──
export const getCateringSettingsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/catering/settings');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateCateringSettingsAPI = async (patch: Partial<CateringSettings>): Promise<unknown> => {
  try {
    const response = await api.patch('/food/vendor/catering/settings', patch);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getCateringRequestsAPI = async (status?: 'new' | 'quoted' | 'confirmed' | 'past'): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/catering/requests', { params: clean({ status }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getCateringRequestAPI = async (code: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/vendor/catering/requests/${enc(code)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const sendQuoteAPI = async (code: string, input: QuoteInput): Promise<unknown> => {
  try {
    const response = await api.post(`/food/vendor/catering/requests/${enc(code)}/quotes`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const declineCateringAPI = async (code: string, reason: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/vendor/catering/requests/${enc(code)}/decline`, { reason: reason.trim() });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const confirmAdvanceAPI = async (code: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/vendor/catering/requests/${enc(code)}/advance/confirm`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const rejectAdvanceAPI = async (code: string, reason: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/vendor/catering/requests/${enc(code)}/advance/reject`, { reason: reason.trim() });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getCateringCalendarAPI = async (month: string): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/catering/calendar', { params: { month } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
