// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Orders Network (API_SHOPPING.md)
// ═══════════════════════════════════════════════════════
// The store's orders by status (or by payment state), one order, and the
// moves the store makes on it. Every move answers with the store's view.

import { API, toApiError, clean, pageParams } from '../../network/network';
import type { CourierKey, PartnerOrderSegment, PaymentStatus } from '../../../models/shopping';
import { courierName } from '../../../models/shopping/orderStatusModel';

const BASE = '/shop/partner/orders';

/** Each tab is one of the API's order statuses. */
const SEGMENT_STATUS: Record<PartnerOrderSegment, string> = {
  new: 'placed',
  to_pack: 'confirmed',
  to_ship: 'packed',
  shipped: 'shipped',
  delivered: 'delivered',
  completed: 'completed',
  cancelled: 'cancelled',
};

export type PartnerOrdersQuery = { segment: PartnerOrderSegment; q?: string } | { paymentStatus: Extract<PaymentStatus, 'proof_submitted' | 'refund_due'>; q?: string };

const ordersParams = (query: PartnerOrdersQuery, page: number, pageSize: number) =>
  clean({
    status: 'segment' in query ? SEGMENT_STATUS[query.segment] : undefined,
    paymentStatus: 'paymentStatus' in query ? query.paymentStatus : undefined,
    q: query.q,
    ...pageParams(page, pageSize),
  });

export type ShipInput = { courier: Exclude<CourierKey, 'own_rider'>; trackingRef: string } | { courier: 'own_rider'; riderName: string; riderPhone: string };

/** A courier and its tracking number, or the store's own rider ("self") with their name and phone. */
const shipBody = (input: ShipInput) =>
  input.courier === 'own_rider'
    ? { courierName: 'self', riderName: input.riderName.trim(), riderPhone: input.riderPhone }
    : { courierName: courierName(input.courier), trackingRef: input.trackingRef.trim() };

export const fetchPartnerOrders = async (query: PartnerOrdersQuery, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: BASE, params: ordersParams(query, page, pageSize) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchPartnerOrder = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/${encodeURIComponent(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

const act = async (id: string, action: string, body?: object): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/${encodeURIComponent(id)}/${action}`, data: body ?? {} });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const confirmOrder = (id: string): Promise<unknown> => act(id, 'confirm');
export const packOrder = (id: string): Promise<unknown> => act(id, 'pack');
export const shipOrder = (id: string, input: ShipInput): Promise<unknown> => act(id, 'ship', shipBody(input));
export const deliverOrder = (id: string): Promise<unknown> => act(id, 'deliver');
export const cancelPartnerOrder = (id: string, reason: string): Promise<unknown> => act(id, 'cancel', { reason });
/** A customer's cancel request is granted by cancelling the order. */
export const approveCancellation = (id: string): Promise<unknown> => act(id, 'cancel', { reason: 'Cancelled at your request.' });
export const confirmPayment = (id: string): Promise<unknown> => act(id, 'payment/confirm');
export const rejectPayment = (id: string, reason: string): Promise<unknown> => act(id, 'payment/reject', { reason });
export const markCashCollected = (id: string): Promise<unknown> => act(id, 'cash-collected');
/** A refund the store sent off the platform (refund due → refunded). */
export const recordOrderRefund = (id: string, refund: { amount: number; reference: string }): Promise<unknown> =>
  act(id, 'refund', { amount: refund.amount, refundRef: refund.reference.trim() });
