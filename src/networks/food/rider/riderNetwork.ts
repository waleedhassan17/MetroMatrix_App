// MetroMatrix — Food rider: who they are, duty, their deliveries and steps,
// their location (the REST batch; the socket is the live path) and cash.
// docs/API_FOOD.md §4.4: GET /food/rider/me; PATCH /food/rider/duty;
// GET /food/rider/orders (+ /:id and its steps); POST /food/rider/location;
// GET /food/rider/cash.

import { api } from '../../network/apiHelpers';
import { riderCashSerializer, riderHomeSerializer, riderOrderSerializer, riderOrdersPageSerializer, riderDutySerializer, riderDeclinedSerializer, locationBatchSerializer } from '../../../serializers/food/riderSerializer';
import { isObject } from '../../../serializers/serializerUtils';
import type { RiderFix } from '../../../services/location/riderLocationCore';
import { request } from '../../shopping/http';

const enc = encodeURIComponent;

export const getRiderHome = () => request(() => api.get('/food/rider/me'), riderHomeSerializer);

/** Only on-duty riders can be given deliveries or share their location. */
export const setDuty = (onDuty: boolean) =>
  request(() => api.patch('/food/rider/duty', { onDuty }), riderDutySerializer);

export const listRiderOrders = (scope: 'active' | 'history', page = 1, pageSize = 20) =>
  request(() => api.get('/food/rider/orders', { params: { scope, page, pageSize } }), riderOrdersPageSerializer);

export const getRiderOrder = (id: string) => request(() => api.get(`/food/rider/orders/${enc(id)}`), riderOrderSerializer);

export type RiderStepAction = 'accept' | 'arrived-branch' | 'picked-up' | 'arrived-customer';

/** accept · at the kitchen · picked up (the kitchen must have marked it ready) · at the customer. */
export const riderStep = (id: string, step: RiderStepAction) => request(() => api.post(`/food/rider/orders/${enc(id)}/${step}`), riderOrderSerializer);

/** Hand it back to the kitchen before pickup. */
export const declineDelivery = (id: string, reason: string) =>
  request(() => api.post(`/food/rider/orders/${enc(id)}/decline`, { reason }), riderDeclinedSerializer);

/** Delivered; cash on delivery records what was taken (≤ the total; the total when left out). */
export const markRiderDelivered = (id: string, codCollected: number | null) =>
  request(() => api.post(`/food/rider/orders/${enc(id)}/delivered`, codCollected === null ? {} : { codCollected }), riderOrderSerializer);

export const getRiderCash = () => request(() => api.get('/food/rider/cash'), riderCashSerializer);

/** Fixes that couldn't go live, oldest first (the socket's fallback). */
export const sendLocationBatch = (fixes: RiderFix[]) =>
  request(
    () =>
      api.post('/food/rider/location', {
        points: fixes.map(f => ({ lat: f.lat, lng: f.lng, ...(f.heading !== null ? { heading: f.heading } : null), ...(f.speed !== null ? { speed: f.speed } : null), ...(f.accuracy !== null ? { accuracy: f.accuracy } : null), at: f.at })),
      }),
    locationBatchSerializer,
  );
