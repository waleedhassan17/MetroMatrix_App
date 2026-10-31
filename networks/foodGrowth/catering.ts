// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Growth Catering Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Catering ("Plan a dawat"), for customers and the kitchen.
// docs/API_KITCHEN_ASSUMED.md §2.10, §3.10, §4.6 (TODO(API_KITCHEN): an assumed contract).

import { API, toApiError, clean } from '../network/network';
import type { CateringRequestInput, CateringSettings, QuoteInput } from '../../models/kitchen';

const enc = encodeURIComponent;

// ── Customers ──
/** What a kitchen takes, and its menu to choose from (by brand id or slug). */
export const fetchCateringVendor = async (vendor: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/catering/vendors/${enc(vendor)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const requestCatering = async (input: CateringRequestInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/catering/requests', data: clean({ ...input }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchMyCateringRequests = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/catering/requests' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchMyCateringRequest = async (code: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/catering/requests/${enc(code)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const acceptQuote = async (code: string, version: number): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/catering/requests/${enc(code)}/quotes/${version}/accept` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const submitAdvanceProof = async (code: string, input: { transactionId: string; imageUrl: string | null }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/catering/requests/${enc(code)}/advance-proof`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const cancelMyCatering = async (code: string, reason?: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/catering/requests/${enc(code)}/cancel`, data: clean({ reason }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// ── The kitchen ──
export const fetchCateringSettings = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/catering/settings' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateCateringSettings = async (patch: Partial<CateringSettings>): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: '/food/vendor/catering/settings', data: patch });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchCateringRequests = async (status?: 'new' | 'quoted' | 'confirmed' | 'past'): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/catering/requests', params: clean({ status }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchCateringRequest = async (code: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendor/catering/requests/${enc(code)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const sendQuote = async (code: string, input: QuoteInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/catering/requests/${enc(code)}/quotes`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const declineCatering = async (code: string, reason: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/catering/requests/${enc(code)}/decline`, data: { reason: reason.trim() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const confirmAdvance = async (code: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/catering/requests/${enc(code)}/advance/confirm` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const rejectAdvance = async (code: string, reason: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/catering/requests/${enc(code)}/advance/reject`, data: { reason: reason.trim() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchCateringCalendar = async (month: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/catering/calendar', params: { month } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
