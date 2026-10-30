// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Surplus Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// Bachat Box for customers (boxes nearby, reserving, my reservations).
// docs/API_KITCHEN_ASSUMED.md §4.4 (TODO(API_KITCHEN): an assumed contract).

import { api, toApiError, clean } from '../network/apiHelpers';
import type { BoxPaymentMethod } from '../../types/kitchen';
import type { FoodPoint } from '../../types/food';

const enc = encodeURIComponent;

export const getSurplusNearbyAPI = async (at: Pick<FoodPoint, 'lat' | 'lng'>): Promise<unknown> => {
  try {
    const response = await api.get('/food/surplus', { params: { lat: at.lat, lng: at.lng } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getSurplusAPI = async (id: string, at?: Pick<FoodPoint, 'lat' | 'lng'> | null): Promise<unknown> => {
  try {
    const response = await api.get(`/food/surplus/${enc(id)}`, { params: clean({ lat: at?.lat, lng: at?.lng }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** `idempotencyKey`: a fresh UUID per attempt, reused for its retries — a retry never reserves twice. */
export const reserveSurplusAPI = async (id: string, input: { quantity: number; paymentMethod: BoxPaymentMethod }, idempotencyKey: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/surplus/${enc(id)}/reserve`, input, { headers: { 'Idempotency-Key': idempotencyKey } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getMyReservationsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/surplus/reservations');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getReservationAPI = async (code: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/surplus/reservations/${enc(code)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const cancelReservationAPI = async (code: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/surplus/reservations/${enc(code)}/cancel`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const submitReservationProofAPI = async (code: string, input: { transactionId: string; imageUrl: string | null }): Promise<unknown> => {
  try {
    const response = await api.post(`/food/surplus/reservations/${enc(code)}/payment-proof`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
