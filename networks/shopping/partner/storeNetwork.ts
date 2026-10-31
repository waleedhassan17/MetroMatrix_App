// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Store Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Today summary, profile, settings, pause, payment accounts.
// TODO(API_SHOPPING): paths per docs/API_SHOPPING_ASSUMED.md.

import { api, toApiError } from '../../network/apiHelpers';
import type { PaymentAccountInput, StoreProfileInput, StoreSettings } from '../../../models/shopping';

const BASE = '/partner/shop';

export const getPartnerSummaryAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get(`${BASE}/summary`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getStoreProfileAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get(`${BASE}/store`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updateStoreProfileAPI = async (input: StoreProfileInput): Promise<unknown> => {
  try {
    const response = await api.patch(`${BASE}/store`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getStoreSettingsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get(`${BASE}/store/settings`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updateStoreSettingsAPI = async (input: StoreSettings): Promise<unknown> => {
  try {
    const response = await api.patch(`${BASE}/store/settings`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const pauseStoreAPI = async (message: string): Promise<unknown> => {
  try {
    const response = await api.post(`${BASE}/store/pause`, { message });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const resumeStoreAPI = async (): Promise<unknown> => {
  try {
    const response = await api.post(`${BASE}/store/resume`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getPaymentAccountsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get(`${BASE}/payment-accounts`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createPaymentAccountAPI = async (input: PaymentAccountInput): Promise<unknown> => {
  try {
    const response = await api.post(`${BASE}/payment-accounts`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updatePaymentAccountAPI = async (id: string, input: PaymentAccountInput): Promise<unknown> => {
  try {
    const response = await api.patch(`${BASE}/payment-accounts/${encodeURIComponent(id)}`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const deletePaymentAccountAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`${BASE}/payment-accounts/${encodeURIComponent(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
