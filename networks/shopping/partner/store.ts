// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Store Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Today summary, profile, settings, pause, payment accounts.
// TODO(API_SHOPPING): paths per docs/API_SHOPPING_ASSUMED.md.

import { API, toApiError } from '../../network/network';
import type { PaymentAccountInput, StoreProfileInput, StoreSettings } from '../../../models/shopping';

const BASE = '/partner/shop';

export const fetchPartnerSummary = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/summary` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchStoreProfile = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/store` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updateStoreProfile = async (input: StoreProfileInput): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/store`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchStoreSettings = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/store/settings` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updateStoreSettings = async (input: StoreSettings): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/store/settings`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const pauseStore = async (message: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/store/pause`, data: { message } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const resumeStore = async (): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/store/resume` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchPaymentAccounts = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/payment-accounts` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createPaymentAccount = async (input: PaymentAccountInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/payment-accounts`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updatePaymentAccount = async (id: string, input: PaymentAccountInput): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/payment-accounts/${encodeURIComponent(id)}`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const deletePaymentAccount = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `${BASE}/payment-accounts/${encodeURIComponent(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
