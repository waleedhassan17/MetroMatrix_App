// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Checkout Network (API_SHOPPING.md §4, §5.3)
// ═══════════════════════════════════════════════════════
// The live preview (the checkout code minus the writes), the coupons a store
// offers this customer, and the one idempotent "Place order".

import { API, toApiError } from '../network/network';
import type { CheckoutInput } from '../../models/shopping';

/** `{ addressId, stores: [{ storeId, paymentMethod, couponCode?, note? }] }`: an empty coupon or note is left out. */
const checkoutBody = (input: CheckoutInput) => ({
  addressId: input.addressId,
  stores: input.stores.map(s => ({
    storeId: s.storeId,
    paymentMethod: s.paymentMethod,
    ...(s.couponCode?.trim() ? { couponCode: s.couponCode.trim() } : null),
    ...(s.note?.trim() ? { note: s.note.trim() } : null),
  })),
});

export const previewCheckout = async (input: CheckoutInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/shop/cart/preview', data: checkoutBody(input) });
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
 * Names every store in the bag exactly once. The `Idempotency-Key` is one
 * attempt's: a retry with it replays the first answer, so a dropped
 * connection never places twice.
 */
export const placeOrder = async (input: CheckoutInput, idempotencyKey: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/shop/checkout', data: checkoutBody(input), headers: { 'Idempotency-Key': idempotencyKey } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
