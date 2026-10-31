// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Orders Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// Placing an order and following it (customer).
// docs/API_FOOD.md §4.2: /food/checkout, /food/orders (+ /:code, /tracking,
// /cancel, /payment-proof, /reorder).

import { API, toApiError } from '../network/network';
import type { FoodCheckoutInput } from '../../models/food';
import { orderDetails } from './cart';

const enc = encodeURIComponent;

/** One Idempotency-Key per attempt: a retry can never place the order twice. */
export const placeFoodOrder = async (input: FoodCheckoutInput, idempotencyKey: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/checkout', data: { ...orderDetails(input), ...(input.source ? { source: { kind: input.source.kind, slug: input.source.slug } } : null) }, headers: { 'Idempotency-Key': idempotencyKey } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchFoodOrders = async (status: 'active' | 'past', page: number, pageSize: number): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/orders', params: { status, page, pageSize } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchFoodOrder = async (code: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/orders/${enc(code)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchFoodTracking = async (code: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/orders/${enc(code)}/tracking` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Only while the vendor hasn't answered yet. */
export const cancelFoodOrder = async (code: string, reason: string | null): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/orders/${enc(code)}/cancel`, data: reason ? { reason } : {} });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const submitFoodPaymentProof = async (code: string, input: { paymentRef: string; proofUrl: string | null }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/orders/${enc(code)}/payment-proof`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Back into the bag; dishes that are gone are dropped, new prices said. */
export const reorderFood = async (code: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/orders/${enc(code)}/reorder` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
