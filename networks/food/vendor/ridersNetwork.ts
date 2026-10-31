// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Vendor Riders Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// The vendor's own riders. A new rider's username
// and password come back once; after that only a reset issues a password.
// docs/API_FOOD.md §4.3 Riders: /food/vendor/riders (+ /:id, /:id/status,
// /:id/reset-password, /:id/credential, /suggest, /live, /:id/cash, /:id/handover).

import { api, toApiError } from '../../network/apiHelpers';
import type { RiderInput, RiderStatus } from '../../../models/food';

const enc = encodeURIComponent;
const body = (input: Partial<RiderInput>) => ({
  ...(input.fullName !== undefined ? { fullName: input.fullName } : null),
  ...(input.phone ? { phone: input.phone } : null),
  ...(input.vehicle ? { vehicle: input.vehicle } : null),
});

export const getRidersAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/riders');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Counts against the plan (409 PLAN_LIMIT_REACHED). */
export const createRiderAPI = async (input: RiderInput): Promise<unknown> => {
  try {
    const response = await api.post('/food/vendor/riders', body(input));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getRiderAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/vendor/riders/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateRiderAPI = async (id: string, input: Partial<RiderInput>): Promise<unknown> => {
  try {
    const response = await api.patch(`/food/vendor/riders/${enc(id)}`, body(input));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** active · inactive (signs them out) · on_leave. Activating needs a free seat. */
export const setRiderStatusAPI = async (id: string, status: Extract<RiderStatus, 'active' | 'inactive' | 'on_leave'>): Promise<unknown> => {
  try {
    const response = await api.patch(`/food/vendor/riders/${enc(id)}/status`, { status });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A new password, shown once; the rider is signed out everywhere. */
export const resetRiderPasswordAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/vendor/riders/${enc(id)}/reset-password`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** On-duty riders for an order: fewest deliveries first, then nearest (live locations only). */
export const suggestRidersAPI = async (orderId: string): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/riders/suggest', { params: { orderId } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Active riders: on duty or not, where they are (while it's live), what they carry. */
export const liveRidersAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/riders/live');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getRiderCashForVendorAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/vendor/riders/${enc(id)}/cash`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The rider handed cash over (never more than they hold). */
export const recordHandoverAPI = async (id: string, amount: number, note: string | null): Promise<unknown> => {
  try {
    const response = await api.post(`/food/vendor/riders/${enc(id)}/handover`, note ? { amount, note } : { amount });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
