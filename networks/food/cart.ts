// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Cart Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// The bag (one vendor at a time) and its preview.
// docs/API_FOOD.md §4.2: /food/cart (+ /items, /preview).

import { API, toApiError } from '../network/network';
import type { FoodCheckoutInput, FoodFulfilment } from '../../models/food';

const enc = encodeURIComponent;

export const fetchFoodCart = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/cart' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A vendor's pre-order slots for the next week, with places left (vendor id or slug). */
export const fetchVendorSlots = async (vendor: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendors/${enc(vendor)}/slots` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const clearFoodCart = async (): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: '/food/cart' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Delivery or pick-up, and when (null: as soon as possible). */
export const setFoodCartMode = async (input: { fulfilment?: FoodFulfilment; scheduledFor?: string | null }): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: '/food/cart', data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * Add a dish. Another vendor's dishes in the bag → 409 CART_OTHER_VENDOR
 * (details.currentVendor); `replace` starts a new bag instead.
 */
export const addToFoodCart = async (input: { vendorId: string; itemId: string; variantId: string | null; optionIds: string[]; quantity: number; notes: string | null }, replace = false): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/cart/items', data: { vendorId: input.vendorId, itemId: input.itemId, variantId: input.variantId, optionIds: input.optionIds, quantity: input.quantity, ...(input.notes ? { notes: input.notes } : null) }, params: replace ? { replace: 'true' } : undefined });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateFoodCartLine = async (lineId: string, input: { quantity?: number; notes?: string | null }): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/food/cart/items/${enc(lineId)}`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const removeFoodCartLine = async (lineId: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/food/cart/items/${enc(lineId)}` });
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
export const previewFoodCart = async (input: Partial<FoodCheckoutInput>): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/cart/preview', data: orderDetails(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export { orderDetails };
