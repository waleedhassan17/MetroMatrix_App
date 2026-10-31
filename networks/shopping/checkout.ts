// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Checkout Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Live preview, coupons, and the one
// idempotent "Place order".
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { API, toApiError } from '../network/network';
import type { CheckoutInput } from '../../models/shopping';

export const previewCheckout = async (input: CheckoutInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/shop/cart/preview', data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchAvailableCoupons = async (storeId: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/shop/stores/${encodeURIComponent(storeId)}/coupons/available` });
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
export const placeOrder = async (input: CheckoutInput, idempotencyKey: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/shop/checkout', data: input, headers: { 'Idempotency-Key': idempotencyKey } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
