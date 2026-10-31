// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Surplus Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Bachat Box (the kitchen's boxes and reservations).
// docs/API_KITCHEN_ASSUMED.md §4.4 (TODO(API_KITCHEN): an assumed contract).
// The customer's side is networks/food/surplusNetwork.ts.

import { API, toApiError } from '../network/network';
import type { SurplusBoxInput } from '../../models/kitchen';

const enc = encodeURIComponent;

export const fetchBoxes = async (scope: 'live' | 'past'): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/surplus', params: { scope } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The end-of-day suggestion; null before the evening or with nothing to suggest. */
export const fetchBoxSuggestion = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/surplus/suggestion' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createBox = async (input: SurplusBoxInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/surplus', data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchBox = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendor/surplus/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateBox = async (id: string, patch: { quantity?: number; pickupTo?: string }): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/food/vendor/surplus/${enc(id)}`, data: patch });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const endBox = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/surplus/${enc(id)}/end` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const collectReservation = async (code: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/surplus/reservations/${enc(code.trim().toUpperCase())}/collect` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const markNoShow = async (code: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/surplus/reservations/${enc(code)}/no-show` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const confirmBoxPayment = async (code: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/surplus/reservations/${enc(code)}/payment/confirm` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const rejectBoxPayment = async (code: string, reason: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/surplus/reservations/${enc(code)}/payment/reject`, data: { reason: reason.trim() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
