// MetroMatrix — Food Court: Bachat Box for customers (boxes nearby, reserving, my reservations).
// docs/API_KITCHEN_ASSUMED.md §4.4 (TODO(API_KITCHEN): an assumed contract).

import { api } from '../network/apiHelpers';
import { clean, request } from '../shopping/http';
import { reservationSerializer, reservationsSerializer, surplusCardsSerializer, surplusDetailSerializer } from '../../serializers/kitchen/surplusSerializer';
import type { BoxPaymentMethod } from '../../types/kitchen';
import type { FoodPoint } from '../../types/food';

const enc = encodeURIComponent;

export const listSurplusNearby = (at: Pick<FoodPoint, 'lat' | 'lng'>) => request(() => api.get('/food/surplus', { params: { lat: at.lat, lng: at.lng } }), surplusCardsSerializer);

export const getSurplus = (id: string, at?: Pick<FoodPoint, 'lat' | 'lng'> | null) =>
  request(() => api.get(`/food/surplus/${enc(id)}`, { params: clean({ lat: at?.lat, lng: at?.lng }) }), surplusDetailSerializer);

/** `idempotencyKey`: a fresh UUID per attempt, reused for its retries — a retry never reserves twice. */
export const reserveSurplus = (id: string, input: { quantity: number; paymentMethod: BoxPaymentMethod }, idempotencyKey: string) =>
  request(() => api.post(`/food/surplus/${enc(id)}/reserve`, input, { headers: { 'Idempotency-Key': idempotencyKey } }), reservationSerializer);

export const listMyReservations = () => request(() => api.get('/food/surplus/reservations'), reservationsSerializer);

export const getReservation = (code: string) => request(() => api.get(`/food/surplus/reservations/${enc(code)}`), reservationSerializer);

export const cancelReservation = (code: string) => request(() => api.post(`/food/surplus/reservations/${enc(code)}/cancel`), reservationSerializer);

export const submitReservationProof = (code: string, input: { transactionId: string; imageUrl: string | null }) =>
  request(() => api.post(`/food/surplus/reservations/${enc(code)}/payment-proof`, input), reservationSerializer);
