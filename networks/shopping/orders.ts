// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Orders Network (API_SHOPPING.md §5.3)
// ═══════════════════════════════════════════════════════
// An order group is what one checkout made; each store order in it moves on
// its own, so the customer's actions are on a store order and answer it.

import { API, toApiError, pageParams } from '../network/network';
import type { OrderSegment } from '../../models/shopping';

/** `status=active|completed|cancelled`: a group is listed when any of its store orders matches. */
export const fetchOrders = async (segment: OrderSegment, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/shop/orders', params: { status: segment, ...pageParams(page, pageSize) } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The code is case-insensitive. */
export const fetchOrderGroup = async (groupCode: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/shop/orders/${encodeURIComponent(groupCode)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchStoreOrder = async (orderId: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/shop/store-orders/${encodeURIComponent(orderId)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Only while `placed`. */
export const cancelOrder = async (orderId: string, reason: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/shop/store-orders/${encodeURIComponent(orderId)}/cancel`, data: { reason } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Confirmed or packed: the store is told and decides (once; again is 409 CONFLICT). */
export const requestCancellation = async (orderId: string, reason: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/shop/store-orders/${encodeURIComponent(orderId)}/request-cancel`, data: { reason } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Shipped → delivered. */
export const confirmReceived = async (orderId: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/shop/store-orders/${encodeURIComponent(orderId)}/received` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

const proofBody = (body: { transactionId: string; imageUrl: string | null }) => ({
  paymentRef: body.transactionId,
  ...(body.imageUrl ? { proofUrl: body.imageUrl } : null),
});

/** A transfer awaiting payment: the transaction id (`paymentRef`) and, optionally, a `payment_proof` upload. */
export const submitPaymentProof = async (orderId: string, body: { transactionId: string; imageUrl: string | null }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/shop/store-orders/${encodeURIComponent(orderId)}/payment-proof`, data: proofBody(body) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
