// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Catalog Network (API_SHOPPING.md §5.2)
// ═══════════════════════════════════════════════════════
// Public routes with optional auth: signed in, product cards carry
// `isWishlisted`. Anything not visible (paused store, unpublished product) is 404.

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

/** `categoryId` = stores selling there (a root matches its subtree); `city` = stores delivering there. */
export const fetchStores = async (
  query: { q?: string; city?: string | null; categoryId?: string; featured?: boolean },
  page: number,
  pageSize = 20,
): Promise<unknown> => {
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

/** The app's sorts in the API's words ("trending" is its `popular`). */
const productParams = (query: ProductQuery) => clean({ ...query, sort: query.sort === 'trending' ? 'popular' : query.sort });

export const fetchProducts = async (query: ProductQuery, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/shop/products', params: { ...productParams(query), ...pageParams(page, pageSize) } });
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

/** Up to 10 products from the same category, other stores first. */
export const fetchRelatedProducts = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/shop/products/${encodeURIComponent(id)}/related` });
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

/** The report sheet's reasons, as the API names them. */
const REPORT_REASON: Record<string, string> = {
  'Counterfeit or copy': 'counterfeit',
  'Misleading photos or description': 'misleading',
  'Prohibited item': 'prohibited_item',
  'Offensive content': 'offensive',
  'Wrong category': 'wrong_category',
};

const reportBody = (body: { reason: string; details: string | null }) => ({
  reason: REPORT_REASON[body.reason] ?? 'other',
  ...(body.details ? { details: body.details } : null),
});

/** One open report per customer and product (`409 CONFLICT` while it's open). */
export const reportProduct = async (id: string, body: { reason: string; details: string | null }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/shop/products/${encodeURIComponent(id)}/report`, data: reportBody(body) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
