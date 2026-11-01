// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Surplus Network (docs/API_KITCHEN.md §10)
// ═══════════════════════════════════════════════════════
// Bachat Box for customers: boxes nearby, a box's page, reserving, my
// reservations (each by id), the transfer receipt.

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

/** One box in any state (an old link says it has gone), with the distance from `at`. */
export const fetchSurplus = async (id: string, at?: Pick<FoodPoint, 'lat' | 'lng'> | null): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/surplus/${enc(id)}`, params: clean({ lat: at?.lat, lng: at?.lng }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

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

/** Before the window closes; the box goes back on the shelf. */
export const cancelReservation = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/surplus/reservations/${enc(id)}/cancel` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A transfer's receipt (a payment_proof upload of yours); the kitchen checks it. */
export const submitReservationProof = async (id: string, input: { transactionId: string; imageUrl: string | null; publicId?: string | null }): Promise<unknown> => {
  try {
    const data = clean({ proofUrl: input.imageUrl, publicId: input.publicId, ref: input.transactionId.trim() });
    const response = await API.POST({ URL: `/food/surplus/reservations/${enc(id)}/payment-proof`, data });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
