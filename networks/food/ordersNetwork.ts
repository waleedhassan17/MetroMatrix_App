// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Orders Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// Placing an order and following it (customer).
// docs/API_FOOD.md §4.2: /food/checkout, /food/orders (+ /:code, /tracking,
// /cancel, /payment-proof, /reorder).

import { api, toApiError } from '../network/apiHelpers';
import type { FoodCheckoutInput } from '../../types/food';
import { orderDetails } from './cartNetwork';

const enc = encodeURIComponent;

/** One Idempotency-Key per attempt: a retry can never place the order twice. */
export const placeFoodOrderAPI = async (input: FoodCheckoutInput, idempotencyKey: string): Promise<unknown> => {
  try {
    const response = await api.post(
        '/food/checkout',
        // The kitchen's own link or QR it came through (TODO(API_KITCHEN): docs/API_KITCHEN_ASSUMED.md §5).
        { ...orderDetails(input), ...(input.source ? { source: { kind: input.source.kind, slug: input.source.slug } } : null) },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      );
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getFoodOrdersAPI = async (status: 'active' | 'past', page: number, pageSize: number): Promise<unknown> => {
  try {
    const response = await api.get('/food/orders', { params: { status, page, pageSize } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getFoodOrderAPI = async (code: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/orders/${enc(code)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getFoodTrackingAPI = async (code: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/orders/${enc(code)}/tracking`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Only while the vendor hasn't answered yet. */
export const cancelFoodOrderAPI = async (code: string, reason: string | null): Promise<unknown> => {
  try {
    const response = await api.post(`/food/orders/${enc(code)}/cancel`, reason ? { reason } : {});
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const submitFoodPaymentProofAPI = async (code: string, input: { paymentRef: string; proofUrl: string | null }): Promise<unknown> => {
  try {
    const response = await api.post(`/food/orders/${enc(code)}/payment-proof`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Back into the bag; dishes that are gone are dropped, new prices said. */
export const reorderFoodAPI = async (code: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/orders/${enc(code)}/reorder`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
