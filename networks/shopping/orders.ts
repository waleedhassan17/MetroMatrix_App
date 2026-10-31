// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Orders Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { API, toApiError, pageParams } from '../network/network';
import type { OrderSegment } from '../../models/shopping';

export const fetchOrders = async (segment: OrderSegment, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/shop/orders', params: { segment, ...pageParams(page, pageSize) } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchOrderGroup = async (groupCode: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/shop/orders/${encodeURIComponent(groupCode)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Each action answers with the whole group, so the screen redraws from it. */
const act = async (orderId: string, action: string, body?: object): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/shop/orders/${encodeURIComponent(orderId)}/${action}`, data: body ?? {} });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const cancelOrder = (orderId: string, reason: string): Promise<unknown> => act(orderId, 'cancel', { reason });
export const requestCancellation = (orderId: string, reason: string): Promise<unknown> => act(orderId, 'cancel-request', { reason });
export const confirmReceived = (orderId: string): Promise<unknown> => act(orderId, 'received');
export const submitPaymentProof = (orderId: string, body: { transactionId: string; imageUrl: string | null }): Promise<unknown> => act(orderId, 'payment-proof', body);
