// MetroMatrix — Bag network. The server owns prices and totals; every
// mutation answers with the whole recomputed bag.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api } from '../network/apiHelpers';
import { cartSerializer } from '../../serializers/shopping/cartSerializer';
import { request } from './http';

export const getCart = () => request(() => api.get('/shop/cart'), cartSerializer);

export const addToCart = (variantId: string, quantity: number) =>
  request(() => api.post('/shop/cart/items', { variantId, quantity }), cartSerializer);

export const updateCartLine = (lineId: string, quantity: number) =>
  request(() => api.patch(`/shop/cart/items/${encodeURIComponent(lineId)}`, { quantity }), cartSerializer);

export const removeCartLine = (lineId: string) =>
  request(() => api.delete(`/shop/cart/items/${encodeURIComponent(lineId)}`), cartSerializer);

/** "Got it" on a price change: the line takes the new price. */
export const acknowledgeCart = (lineIds: string[]) =>
  request(() => api.post('/shop/cart/acknowledge', { lineIds }), cartSerializer);
