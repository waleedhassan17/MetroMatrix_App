// MetroMatrix — Food Court: placing an order and following it (customer).
// docs/API_FOOD.md §4.2: /food/checkout, /food/orders (+ /:code, /tracking,
// /cancel, /payment-proof, /reorder).

import { api } from '../network/apiHelpers';
import { foodCartSerializer, foodOrderSerializer, foodOrdersPageSerializer, foodTrackingSerializer } from '../../serializers/food/orderSerializer';
import { isObject } from '../../serializers/serializerUtils';
import type { FoodCheckoutInput } from '../../types/food';
import { request } from '../shopping/http';
import { orderDetails } from './cartNetwork';

const enc = encodeURIComponent;

/** One Idempotency-Key per attempt: a retry can never place the order twice. */
export const placeFoodOrder = (input: FoodCheckoutInput, idempotencyKey: string) =>
  request(() => api.post('/food/checkout', orderDetails(input), { headers: { 'Idempotency-Key': idempotencyKey } }), foodOrderSerializer);

export const listFoodOrders = (status: 'active' | 'past', page: number, pageSize: number) =>
  request(() => api.get('/food/orders', { params: { status, page, pageSize } }), foodOrdersPageSerializer);

export const getFoodOrder = (code: string) => request(() => api.get(`/food/orders/${enc(code)}`), foodOrderSerializer);

export const getFoodTracking = (code: string) => request(() => api.get(`/food/orders/${enc(code)}/tracking`), foodTrackingSerializer);

/** Only while the vendor hasn't answered yet. */
export const cancelFoodOrder = (code: string, reason: string | null) =>
  request(() => api.post(`/food/orders/${enc(code)}/cancel`, reason ? { reason } : {}), foodOrderSerializer);

export const submitFoodPaymentProof = (code: string, input: { paymentRef: string; proofUrl: string | null }) =>
  request(() => api.post(`/food/orders/${enc(code)}/payment-proof`, input), foodOrderSerializer);

/** Back into the bag; dishes that are gone are dropped, new prices said. */
export const reorderFood = (code: string) =>
  request(
    () => api.post(`/food/orders/${enc(code)}/reorder`),
    raw => {
      const r = isObject(raw) ? raw : {};
      const cart = foodCartSerializer(r.cart);
      return cart ? { cart, dropped: Array.isArray(r.dropped) ? r.dropped.length : 0, priceChanges: Array.isArray(r.priceChanges) ? r.priceChanges.length : 0 } : null;
    },
  );
