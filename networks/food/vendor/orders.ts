// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Vendor Orders Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// The order board and each order's moves.
// docs/API_FOOD.md §4.3 Orders: /food/vendor/orders (+ /:id and its actions).

import { API, toApiError } from '../../network/network';

const enc = encodeURIComponent;

/** new · active · done, or one status; `scheduled` for pre-orders. */
export const fetchBoard = async (status: 'new' | 'active' | 'done', page = 1, pageSize = 50): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/orders', params: { status, page, pageSize } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchVendorOrder = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendor/orders/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

const act = async (id: string, action: string, body?: object): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/orders/${enc(id)}/${action}`, data: body ?? {} });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** placed → accepted, with the ETA in minutes (5–180). */
export const acceptOrder = (id: string, etaMinutes: number): Promise<unknown> => act(id, 'accept', { etaMinutes });
export const rejectOrder = (id: string, reason: string): Promise<unknown> => act(id, 'reject', { reason });
/** A transfer must be confirmed first (409 PAYMENT_NOT_CONFIRMED). */
export const startPreparing = (id: string): Promise<unknown> => act(id, 'preparing');
export const markReady = (id: string): Promise<unknown> => act(id, 'ready');
/** One of the vendor's own riders, active and on duty. */
export const assignRider = (id: string, riderId: string): Promise<unknown> => act(id, 'assign', { riderId });
/** Handed to someone who isn't on the app (a family member, a neighbour's bike). */
export const handedExternal = (id: string): Promise<unknown> => act(id, 'handed-external');
/** Pick-up: the customer collected it (pay at pickup is settled). */
export const markCollected = (id: string): Promise<unknown> => act(id, 'picked-up');
/** on_the_way → delivered; cash on delivery records what was taken. */
export const markDelivered = (id: string, codCollected: number | null): Promise<unknown> => act(id, 'delivered', codCollected === null ? {} : { codCollected });
export const cancelVendorOrder = (id: string, reason: string): Promise<unknown> => act(id, 'cancel', { reason });
export const confirmPayment = (id: string): Promise<unknown> => act(id, 'payment/confirm');
export const rejectPayment = (id: string, reason: string): Promise<unknown> => act(id, 'payment/reject', { reason });
