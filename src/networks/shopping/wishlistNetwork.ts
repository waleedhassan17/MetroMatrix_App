// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Wishlist Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api, toApiError, pageParams } from '../network/apiHelpers';

export const getWishlistAPI = async (page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await api.get('/shop/wishlist', { params: pageParams(page, pageSize) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Every saved product id — drives the hearts on cards. */
export const getWishlistIdsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/shop/wishlist/ids');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const saveProductAPI = async (productId: string): Promise<unknown> => {
  try {
    const response = await api.put(`/shop/wishlist/${encodeURIComponent(productId)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const unsaveProductAPI = async (productId: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/shop/wishlist/${encodeURIComponent(productId)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
