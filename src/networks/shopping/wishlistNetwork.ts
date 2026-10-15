// MetroMatrix — Wishlist ("Saved") network.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api } from '../network/apiHelpers';
import { productSummarySerializer } from '../../serializers/shopping/catalogSerializer';
import { paged } from '../../serializers/shopping/common';
import { arr, str } from '../../serializers/serializerUtils';
import { ack, pageParams, request } from './http';

export const listWishlist = (page: number, pageSize = 20) =>
  request(() => api.get('/shop/wishlist', { params: pageParams(page, pageSize) }), raw => paged(raw, productSummarySerializer));

/** Every saved product id — drives the hearts on cards. */
export const getWishlistIds = () =>
  request(() => api.get('/shop/wishlist/ids'), raw => arr(raw).map(v => str(v)).filter(Boolean));

export const saveProduct = (productId: string) =>
  request(() => api.put(`/shop/wishlist/${encodeURIComponent(productId)}`), ack);

export const unsaveProduct = (productId: string) =>
  request(() => api.delete(`/shop/wishlist/${encodeURIComponent(productId)}`), ack);
