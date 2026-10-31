// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Rider Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// Who they are, duty, their deliveries and steps,
// their location (the REST batch; the socket is the live path) and cash.
// docs/API_FOOD.md §4.4: GET /food/rider/me; PATCH /food/rider/duty;
// GET /food/rider/orders (+ /:id and its steps); POST /food/rider/location;
// GET /food/rider/cash.

import { API, toApiError } from '../../network/network';
import type { RiderFix } from '../../../services/location/riderLocationCore';

const enc = encodeURIComponent;

export const fetchRiderHome = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/rider/me' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Only on-duty riders can be given deliveries or share their location. */
export const setDuty = async (onDuty: boolean): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: '/food/rider/duty', data: { onDuty } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchRiderOrders = async (scope: 'active' | 'history', page = 1, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/rider/orders', params: { scope, page, pageSize } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchRiderOrder = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/rider/orders/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export type RiderStepAction = 'accept' | 'arrived-branch' | 'picked-up' | 'arrived-customer';

/** accept · at the kitchen · picked up (the kitchen must have marked it ready) · at the customer. */
export const riderStep = async (id: string, step: RiderStepAction): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/rider/orders/${enc(id)}/${step}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Hand it back to the kitchen before pickup. */
export const declineDelivery = async (id: string, reason: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/rider/orders/${enc(id)}/decline`, data: { reason } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Delivered; cash on delivery records what was taken (≤ the total; the total when left out). */
export const markRiderDelivered = async (id: string, codCollected: number | null): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/rider/orders/${enc(id)}/delivered`, data: codCollected === null ? {} : { codCollected } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchRiderCash = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/rider/cash' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Fixes that couldn't go live, oldest first (the socket's fallback). */
export const sendLocationBatch = async (fixes: RiderFix[]): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/rider/location', data: {
        points: fixes.map(f => ({ lat: f.lat, lng: f.lng, ...(f.heading !== null ? { heading: f.heading } : null), ...(f.speed !== null ? { speed: f.speed } : null), ...(f.accuracy !== null ? { accuracy: f.accuracy } : null), at: f.at })),
      } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
