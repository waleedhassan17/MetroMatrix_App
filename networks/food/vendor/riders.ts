// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Vendor Riders Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// The vendor's own riders. A new rider's username
// and password come back once; after that only a reset issues a password.
// docs/API_FOOD.md §4.3 Riders: /food/vendor/riders (+ /:id, /:id/status,
// /:id/reset-password, /:id/credential, /suggest, /live, /:id/cash, /:id/handover).

import { API, toApiError } from '../../network/network';
import type { RiderInput, RiderStatus } from '../../../models/food';

const enc = encodeURIComponent;
const body = (input: Partial<RiderInput>) => ({
  ...(input.fullName !== undefined ? { fullName: input.fullName } : null),
  ...(input.phone ? { phone: input.phone } : null),
  ...(input.vehicle ? { vehicle: input.vehicle } : null),
});

export const fetchRiders = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/riders' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Counts against the plan (409 PLAN_LIMIT_REACHED). */
export const createRider = async (input: RiderInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/riders', data: body(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchRider = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendor/riders/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateRider = async (id: string, input: Partial<RiderInput>): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/food/vendor/riders/${enc(id)}`, data: body(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** active · inactive (signs them out) · on_leave. Activating needs a free seat. */
export const setRiderStatus = async (id: string, status: Extract<RiderStatus, 'active' | 'inactive' | 'on_leave'>): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/food/vendor/riders/${enc(id)}/status`, data: { status } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A new password, shown once; the rider is signed out everywhere. */
export const resetRiderPassword = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/riders/${enc(id)}/reset-password` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** On-duty riders for an order: fewest deliveries first, then nearest (live locations only). */
export const suggestRiders = async (orderId: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/riders/suggest', params: { orderId } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Active riders: on duty or not, where they are (while it's live), what they carry. */
export const liveRiders = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/riders/live' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchRiderCashForVendor = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendor/riders/${enc(id)}/cash` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The rider handed cash over (never more than they hold). */
export const recordHandover = async (id: string, amount: number, note: string | null): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/riders/${enc(id)}/handover`, data: note ? { amount, note } : { amount } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
