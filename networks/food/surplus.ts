// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Surplus Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// Bachat Box for customers (boxes nearby, reserving, my reservations).
// docs/API_KITCHEN_ASSUMED.md §4.4 (TODO(API_KITCHEN): an assumed contract).

import { API, toApiError, clean } from '../network/network';
import type { BoxPaymentMethod } from '../../models/kitchen';
import type { FoodPoint } from '../../models/food';

const enc = encodeURIComponent;

export const fetchSurplusNearby = async (at: Pick<FoodPoint, 'lat' | 'lng'>): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/surplus', params: { lat: at.lat, lng: at.lng } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchSurplus = async (id: string, at?: Pick<FoodPoint, 'lat' | 'lng'> | null): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/surplus/${enc(id)}`, params: clean({ lat: at?.lat, lng: at?.lng }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** `idempotencyKey`: a fresh UUID per attempt, reused for its retries — a retry never reserves twice. */
export const reserveSurplus = async (id: string, input: { quantity: number; paymentMethod: BoxPaymentMethod }, idempotencyKey: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/surplus/${enc(id)}/reserve`, data: input, headers: { 'Idempotency-Key': idempotencyKey } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchMyReservations = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/surplus/reservations' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchReservation = async (code: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/surplus/reservations/${enc(code)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const cancelReservation = async (code: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/surplus/reservations/${enc(code)}/cancel` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const submitReservationProof = async (code: string, input: { transactionId: string; imageUrl: string | null }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/surplus/reservations/${enc(code)}/payment-proof`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
