// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Wishlist Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { API, toApiError, pageParams } from '../network/network';

export const fetchWishlist = async (page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/shop/wishlist', params: pageParams(page, pageSize) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Every saved product id — drives the hearts on cards. */
export const fetchWishlistIds = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/shop/wishlist/ids' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const saveProduct = async (productId: string): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: `/shop/wishlist/${encodeURIComponent(productId)}` });
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
