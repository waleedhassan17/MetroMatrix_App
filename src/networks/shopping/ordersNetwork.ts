// MetroMatrix — Customer orders network.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api } from '../network/apiHelpers';
import { paged } from '../../serializers/shopping/common';
import { orderGroupSerializer, orderGroupSummarySerializer } from '../../serializers/shopping/orderSerializer';
import type { OrderSegment } from '../../types/shopping';
import { pageParams, request } from './http';

export const listOrders = (segment: OrderSegment, page: number, pageSize = 20) =>
  request(() => api.get('/shop/orders', { params: { segment, ...pageParams(page, pageSize) } }), raw =>
    paged(raw, orderGroupSummarySerializer),
  );

export const getOrderGroup = (groupCode: string) =>
  request(() => api.get(`/shop/orders/${encodeURIComponent(groupCode)}`), orderGroupSerializer);

/** Each action answers with the whole group, so the screen redraws from it. */
const act = (orderId: string, action: string, body?: object) =>
  request(() => api.post(`/shop/orders/${encodeURIComponent(orderId)}/${action}`, body ?? {}), orderGroupSerializer);

export const cancelOrder = (orderId: string, reason: string) => act(orderId, 'cancel', { reason });
export const requestCancellation = (orderId: string, reason: string) => act(orderId, 'cancel-request', { reason });
export const confirmReceived = (orderId: string) => act(orderId, 'received');
export const submitPaymentProof = (orderId: string, body: { transactionId: string; imageUrl: string | null }) =>
  act(orderId, 'payment-proof', body);
