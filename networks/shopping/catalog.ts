// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Catalog Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// TODO(API_SHOPPING): paths per docs/API_SHOPPING_ASSUMED.md.

import { API, toApiError, clean, pageParams } from '../network/network';
import type { ProductQuery } from '../../models/shopping';

export const fetchShopHome = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/shop/home' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchCategories = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/shop/categories' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchStores = async (query: { q?: string; city?: string | null }, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/shop/stores', params: clean({ ...query, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchStore = async (slug: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/shop/stores/${encodeURIComponent(slug)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchProducts = async (query: ProductQuery, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/shop/products', params: clean({ ...query, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** "Show N results": the same query with pageSize=1, read for `total`. */
export const suggestProducts = async (q: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/shop/products/suggest', params: { q } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchProduct = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/shop/products/${encodeURIComponent(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchReviews = async (productId: string, filter: { rating?: number | null; withPhotos?: boolean }, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/shop/products/${encodeURIComponent(productId)}/reviews`, params: clean({ ...filter, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const reportProduct = async (id: string, body: { reason: string; details: string | null }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/shop/products/${encodeURIComponent(id)}/report`, data: body });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
