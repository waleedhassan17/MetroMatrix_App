// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Orders Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api, toApiError, pageParams } from '../network/apiHelpers';
import type { OrderSegment } from '../../models/shopping';

export const getOrdersAPI = async (segment: OrderSegment, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await api.get('/shop/orders', { params: { segment, ...pageParams(page, pageSize) } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getOrderGroupAPI = async (groupCode: string): Promise<unknown> => {
  try {
    const response = await api.get(`/shop/orders/${encodeURIComponent(groupCode)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Each action answers with the whole group, so the screen redraws from it. */
const act = async (orderId: string, action: string, body?: object): Promise<unknown> => {
  try {
    const response = await api.post(`/shop/orders/${encodeURIComponent(orderId)}/${action}`, body ?? {});
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const cancelOrderAPI = (orderId: string, reason: string): Promise<unknown> => act(orderId, 'cancel', { reason });
export const requestCancellationAPI = (orderId: string, reason: string): Promise<unknown> => act(orderId, 'cancel-request', { reason });
export const confirmReceivedAPI = (orderId: string): Promise<unknown> => act(orderId, 'received');
export const submitPaymentProofAPI = (orderId: string, body: { transactionId: string; imageUrl: string | null }): Promise<unknown> => act(orderId, 'payment-proof', body);
