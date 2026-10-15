// MetroMatrix — Catalogue network (home, categories, stores, products, reviews).
// TODO(API_SHOPPING): paths per docs/API_SHOPPING_ASSUMED.md.

import { api } from '../network/apiHelpers';
import {
  categorySerializer,
  productDetailSerializer,
  productSummarySerializer,
  reviewSerializer,
  reviewSummarySerializer,
  shopHomeSerializer,
  storeDetailSerializer,
  storeSummarySerializer,
  suggestionSerializer,
} from '../../serializers/shopping/catalogSerializer';
import { compact, paged } from '../../serializers/shopping/common';
import { arr, isObject } from '../../serializers/serializerUtils';
import type { ProductQuery } from '../../types/shopping';
import { ack, clean, pageParams, request } from './http';

export const getShopHome = () => request(() => api.get('/shop/home'), shopHomeSerializer);

export const getCategories = () =>
  request(() => api.get('/shop/categories'), raw => compact(arr(raw).map(categorySerializer)));

export const listStores = (query: { q?: string; city?: string | null }, page: number, pageSize = 20) =>
  request(() => api.get('/shop/stores', { params: clean({ ...query, ...pageParams(page, pageSize) }) }), raw =>
    paged(raw, storeSummarySerializer),
  );

export const getStore = (slug: string) =>
  request(() => api.get(`/shop/stores/${encodeURIComponent(slug)}`), storeDetailSerializer);

export const listProducts = (query: ProductQuery, page: number, pageSize = 20) =>
  request(() => api.get('/shop/products', { params: clean({ ...query, ...pageParams(page, pageSize) }) }), raw =>
    paged(raw, productSummarySerializer),
  );

/** "Show N results": the same query with pageSize=1, read for `total`. */
export const countProducts = (query: ProductQuery) => listProducts(query, 1, 1).then(p => p.total);

export const suggestProducts = (q: string) =>
  request(() => api.get('/shop/products/suggest', { params: { q } }), raw => compact(arr(raw).map(suggestionSerializer)));

export const getProduct = (id: string) =>
  request(() => api.get(`/shop/products/${encodeURIComponent(id)}`), productDetailSerializer);

export const listReviews = (
  productId: string,
  filter: { rating?: number | null; withPhotos?: boolean },
  page: number,
  pageSize = 20,
) =>
  request(
    () => api.get(`/shop/products/${encodeURIComponent(productId)}/reviews`, { params: clean({ ...filter, ...pageParams(page, pageSize) }) }),
    raw => ({
      ...paged(raw, reviewSerializer),
      summary: reviewSummarySerializer(isObject(raw) ? raw.summary : null),
    }),
  );

export const reportProduct = (id: string, body: { reason: string; details: string | null }) =>
  request(() => api.post(`/shop/products/${encodeURIComponent(id)}/report`, body), ack);
