// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Cart Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// The server owns prices and totals; every
// mutation answers with the whole recomputed bag.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { API, toApiError } from '../network/network';

export const fetchCart = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/shop/cart' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const addToCart = async (variantId: string, quantity: number): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/shop/cart/items', data: { variantId, quantity } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateCartLine = async (lineId: string, quantity: number): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/shop/cart/items/${encodeURIComponent(lineId)}`, data: { quantity } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const removeCartLine = async (lineId: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/shop/cart/items/${encodeURIComponent(lineId)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** "Got it" on a price change: the line takes the new price. */
export const acknowledgeCart = async (lineIds: string[]): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/shop/cart/acknowledge', data: { lineIds } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
