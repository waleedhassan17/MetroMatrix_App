// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Catalog Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// TODO(API_SHOPPING): paths per docs/API_SHOPPING_ASSUMED.md.

import { api, toApiError, clean, pageParams } from '../network/apiHelpers';
import type { ProductQuery } from '../../models/shopping';

export const getShopHomeAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/shop/home');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getCategoriesAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/shop/categories');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getStoresAPI = async (query: { q?: string; city?: string | null }, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await api.get('/shop/stores', { params: clean({ ...query, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getStoreAPI = async (slug: string): Promise<unknown> => {
  try {
    const response = await api.get(`/shop/stores/${encodeURIComponent(slug)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getProductsAPI = async (query: ProductQuery, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await api.get('/shop/products', { params: clean({ ...query, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** "Show N results": the same query with pageSize=1, read for `total`. */
export const suggestProductsAPI = async (q: string): Promise<unknown> => {
  try {
    const response = await api.get('/shop/products/suggest', { params: { q } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getProductAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`/shop/products/${encodeURIComponent(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getReviewsAPI = async (productId: string, filter: { rating?: number | null; withPhotos?: boolean }, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await api.get(`/shop/products/${encodeURIComponent(productId)}/reviews`, { params: clean({ ...filter, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const reportProductAPI = async (id: string, body: { reason: string; details: string | null }): Promise<unknown> => {
  try {
    const response = await api.post(`/shop/products/${encodeURIComponent(id)}/report`, body);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
