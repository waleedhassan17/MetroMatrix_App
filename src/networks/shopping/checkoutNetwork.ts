// MetroMatrix — Checkout network: live preview, coupons, and the one
// idempotent "Place order".
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api } from '../network/apiHelpers';
import { availableCouponSerializer, checkoutPreviewSerializer } from '../../serializers/shopping/cartSerializer';
import { compact } from '../../serializers/shopping/common';
import { orderGroupSerializer } from '../../serializers/shopping/orderSerializer';
import { arr } from '../../serializers/serializerUtils';
import type { CheckoutInput } from '../../types/shopping';
import { request } from './http';

export const previewCheckout = (input: CheckoutInput) =>
  request(() => api.post('/shop/cart/preview', input), checkoutPreviewSerializer);

export const listAvailableCoupons = (storeId: string) =>
  request(
    () => api.get(`/shop/stores/${encodeURIComponent(storeId)}/coupons/available`),
    raw => compact(arr(raw).map(availableCouponSerializer)),
  );

/**
 * The same `idempotencyKey` on a retry returns the order the first attempt
 * made — never a second one. Generate it when Checkout mounts; renew it only
 * after a success.
 */
export const placeOrder = (input: CheckoutInput, idempotencyKey: string) =>
  request(
    () => api.post('/shop/checkout', input, { headers: { 'Idempotency-Key': idempotencyKey } }),
    orderGroupSerializer,
  );
