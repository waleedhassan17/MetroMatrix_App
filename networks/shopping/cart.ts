// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Cart Network (API_SHOPPING.md §5.3)
// ═══════════════════════════════════════════════════════
// The server owns prices and totals; every write answers with the whole
// recomputed bag (CartView). A line holds 1–20; a quantity above the stock is
// capped and reported in `adjusted`.

import { API, toApiError } from '../network/network';

export const fetchCart = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/shop/cart' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The same variant merges into its line. */
export const addToCart = async (variantId: string, quantity: number): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/shop/cart/items', data: { variantId, quantity } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Also accepts the line's current price: a PRICE_CHANGED warning clears once the customer has seen it. */
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

export const clearCart = async (): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: '/shop/cart' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
