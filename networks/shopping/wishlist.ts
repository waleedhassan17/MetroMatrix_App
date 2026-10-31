// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Wishlist Network (API_SHOPPING.md §5.3)
// ═══════════════════════════════════════════════════════
// Saving and removing are both idempotent and answer `{ productId, isWishlisted }`.

import { API, toApiError, pageParams } from '../network/network';

export const fetchWishlist = async (page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/shop/wishlist', params: pageParams(page, pageSize) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The saved products' ids drive the hearts on cards: one page of 100 (the newest first). */
export const fetchWishlistIds = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/shop/wishlist', params: pageParams(1, 100) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const saveProduct = async (productId: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/shop/wishlist/${encodeURIComponent(productId)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const unsaveProduct = async (productId: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/shop/wishlist/${encodeURIComponent(productId)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
