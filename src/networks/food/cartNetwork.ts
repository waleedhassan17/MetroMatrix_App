// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Cart Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// The bag (one vendor at a time) and its preview.
// docs/API_FOOD.md §4.2: /food/cart (+ /items, /preview).

import { api, toApiError } from '../network/apiHelpers';
import type { FoodCheckoutInput, FoodFulfilment } from '../../types/food';

const enc = encodeURIComponent;

export const getFoodCartAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/cart');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A vendor's pre-order slots for the next week, with places left (vendor id or slug). */
export const getVendorSlotsAPI = async (vendor: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/vendors/${enc(vendor)}/slots`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const clearFoodCartAPI = async (): Promise<unknown> => {
  try {
    const response = await api.delete('/food/cart');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Delivery or pick-up, and when (null: as soon as possible). */
export const setFoodCartModeAPI = async (input: { fulfilment?: FoodFulfilment; scheduledFor?: string | null }): Promise<unknown> => {
  try {
    const response = await api.patch('/food/cart', input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * Add a dish. Another vendor's dishes in the bag → 409 CART_OTHER_VENDOR
 * (details.currentVendor); `replace` starts a new bag instead.
 */
export const addToFoodCartAPI = async (input: { vendorId: string; itemId: string; variantId: string | null; optionIds: string[]; quantity: number; notes: string | null }, replace = false): Promise<unknown> => {
  try {
    const response = await api.post(
        '/food/cart/items',
        { vendorId: input.vendorId, itemId: input.itemId, variantId: input.variantId, optionIds: input.optionIds, quantity: input.quantity, ...(input.notes ? { notes: input.notes } : null) },
        { params: replace ? { replace: 'true' } : undefined },
      );
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateFoodCartLineAPI = async (lineId: string, input: { quantity?: number; notes?: string | null }): Promise<unknown> => {
  try {
    const response = await api.patch(`/food/cart/items/${enc(lineId)}`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const removeFoodCartLineAPI = async (lineId: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/food/cart/items/${enc(lineId)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

const orderDetails = (input: Partial<FoodCheckoutInput>) => ({
  ...(input.addressId ? { addressId: input.addressId } : null),
  ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : null),
  ...(input.promoCode ? { promoCode: input.promoCode.trim() } : null),
  ...(input.cutlery !== undefined ? { cutlery: input.cutlery } : null),
  ...(input.note ? { note: input.note } : null),
  ...(input.building ? { building: input.building } : null),
  ...(input.floor ? { floor: input.floor } : null),
  ...(input.riderInstructions ? { riderInstructions: input.riderInstructions } : null),
});

/** Totals exactly as checkout would charge them, with every issue to fix. */
export const previewFoodCartAPI = async (input: Partial<FoodCheckoutInput>): Promise<unknown> => {
  try {
    const response = await api.post('/food/cart/preview', orderDetails(input));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export { orderDetails };
