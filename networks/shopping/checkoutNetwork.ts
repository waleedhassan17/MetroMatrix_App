// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Checkout Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Live preview, coupons, and the one
// idempotent "Place order".
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api, toApiError } from '../network/apiHelpers';
import type { CheckoutInput } from '../../models/shopping';

export const previewCheckoutAPI = async (input: CheckoutInput): Promise<unknown> => {
  try {
    const response = await api.post('/shop/cart/preview', input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getAvailableCouponsAPI = async (storeId: string): Promise<unknown> => {
  try {
    const response = await api.get(`/shop/stores/${encodeURIComponent(storeId)}/coupons/available`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * The same `idempotencyKey` on a retry returns the order the first attempt
 * made — never a second one. Generate it when Checkout mounts; renew it only
 * after a success.
 */
export const placeOrderAPI = async (input: CheckoutInput, idempotencyKey: string): Promise<unknown> => {
  try {
    const response = await api.post('/shop/checkout', input, { headers: { 'Idempotency-Key': idempotencyKey } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
