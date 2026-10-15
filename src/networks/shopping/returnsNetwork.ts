// MetroMatrix — Customer returns network.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api } from '../network/apiHelpers';
import { paged } from '../../serializers/shopping/common';
import { returnSerializer } from '../../serializers/shopping/orderSerializer';
import type { ReturnInput } from '../../types/shopping';
import { pageParams, request } from './http';

export const requestReturn = (orderId: string, input: ReturnInput) =>
  request(() => api.post(`/shop/orders/${encodeURIComponent(orderId)}/returns`, input), returnSerializer);

export const listReturns = (page: number, pageSize = 20) =>
  request(() => api.get('/shop/returns', { params: pageParams(page, pageSize) }), raw => paged(raw, returnSerializer));
