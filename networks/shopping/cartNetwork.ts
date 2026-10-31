// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Cart Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// The server owns prices and totals; every
// mutation answers with the whole recomputed bag.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api, toApiError } from '../network/apiHelpers';

export const getCartAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/shop/cart');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const addToCartAPI = async (variantId: string, quantity: number): Promise<unknown> => {
  try {
    const response = await api.post('/shop/cart/items', { variantId, quantity });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateCartLineAPI = async (lineId: string, quantity: number): Promise<unknown> => {
  try {
    const response = await api.patch(`/shop/cart/items/${encodeURIComponent(lineId)}`, { quantity });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const removeCartLineAPI = async (lineId: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/shop/cart/items/${encodeURIComponent(lineId)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** "Got it" on a price change: the line takes the new price. */
export const acknowledgeCartAPI = async (lineIds: string[]): Promise<unknown> => {
  try {
    const response = await api.post('/shop/cart/acknowledge', { lineIds });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
