// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Surplus Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Bachat Box (the kitchen's boxes and reservations).
// docs/API_KITCHEN_ASSUMED.md §4.4 (TODO(API_KITCHEN): an assumed contract).
// The customer's side is networks/food/surplusNetwork.ts.

import { api, toApiError } from '../network/apiHelpers';
import type { SurplusBoxInput } from '../../types/kitchen';

const enc = encodeURIComponent;

export const getBoxesAPI = async (scope: 'live' | 'past'): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/surplus', { params: { scope } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The end-of-day suggestion; null before the evening or with nothing to suggest. */
export const getBoxSuggestionAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/surplus/suggestion');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createBoxAPI = async (input: SurplusBoxInput): Promise<unknown> => {
  try {
    const response = await api.post('/food/vendor/surplus', input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getBoxAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/vendor/surplus/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateBoxAPI = async (id: string, patch: { quantity?: number; pickupTo?: string }): Promise<unknown> => {
  try {
    const response = await api.patch(`/food/vendor/surplus/${enc(id)}`, patch);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const endBoxAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/vendor/surplus/${enc(id)}/end`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const collectReservationAPI = async (code: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/vendor/surplus/reservations/${enc(code.trim().toUpperCase())}/collect`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const markNoShowAPI = async (code: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/vendor/surplus/reservations/${enc(code)}/no-show`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const confirmBoxPaymentAPI = async (code: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/vendor/surplus/reservations/${enc(code)}/payment/confirm`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const rejectBoxPaymentAPI = async (code: string, reason: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/vendor/surplus/reservations/${enc(code)}/payment/reject`, { reason: reason.trim() });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
