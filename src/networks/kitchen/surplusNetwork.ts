// MetroMatrix — Kitchen: Bachat Box (the kitchen's boxes and reservations).
// docs/API_KITCHEN_ASSUMED.md §4.4 (TODO(API_KITCHEN): an assumed contract).
// The customer's side is networks/food/surplusNetwork.ts.

import { api } from '../network/apiHelpers';
import { request } from '../shopping/http';
import {
  reservationSerializer,
  surplusBoxDetailSerializer,
  surplusBoxSerializer,
  surplusBoxesSerializer,
  surplusSuggestionSerializer,
} from '../../serializers/kitchen/surplusSerializer';
import type { SurplusBoxInput } from '../../types/kitchen';

const enc = encodeURIComponent;

export const listBoxes = (scope: 'live' | 'past') => request(() => api.get('/food/vendor/surplus', { params: { scope } }), surplusBoxesSerializer);

/** The end-of-day suggestion; null before the evening or with nothing to suggest. */
export const getBoxSuggestion = () =>
  request(() => api.get('/food/vendor/surplus/suggestion'), raw => ({ suggestion: surplusSuggestionSerializer(raw) }));

export const createBox = (input: SurplusBoxInput) => request(() => api.post('/food/vendor/surplus', input), surplusBoxSerializer);

export const getBox = (id: string) => request(() => api.get(`/food/vendor/surplus/${enc(id)}`), surplusBoxDetailSerializer);

export const updateBox = (id: string, patch: { quantity?: number; pickupTo?: string }) => request(() => api.patch(`/food/vendor/surplus/${enc(id)}`, patch), surplusBoxSerializer);

export const endBox = (id: string) => request(() => api.post(`/food/vendor/surplus/${enc(id)}/end`), surplusBoxSerializer);

export const collectReservation = (code: string) => request(() => api.post(`/food/vendor/surplus/reservations/${enc(code.trim().toUpperCase())}/collect`), reservationSerializer);

export const markNoShow = (code: string) => request(() => api.post(`/food/vendor/surplus/reservations/${enc(code)}/no-show`), reservationSerializer);

export const confirmBoxPayment = (code: string) => request(() => api.post(`/food/vendor/surplus/reservations/${enc(code)}/payment/confirm`), reservationSerializer);

export const rejectBoxPayment = (code: string, reason: string) =>
  request(() => api.post(`/food/vendor/surplus/reservations/${enc(code)}/payment/reject`, { reason: reason.trim() }), reservationSerializer);
