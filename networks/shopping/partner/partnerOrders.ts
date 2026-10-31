// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Orders Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Orders and their actions.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { API, toApiError, clean, pageParams } from '../../network/network';
import type { CourierKey, PartnerOrderSegment } from '../../../models/shopping';

const BASE = '/partner/shop/orders';

/** `payment: 'proof_submitted'` lists every order with a transfer to check, across segments. */
export const fetchPartnerOrders = async (query: { segment: PartnerOrderSegment; q?: string; payment?: 'proof_submitted' }, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: BASE, params: clean({ ...query, ...pageParams(page, pageSize) }) });
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
export const shipOrder = (id: string, shipment: { courier: CourierKey; trackingRef: string }): Promise<unknown> => act(id, 'ship', shipment);
export const deliverOrder = (id: string): Promise<unknown> => act(id, 'deliver');
export const cancelPartnerOrder = (id: string, reason: string): Promise<unknown> => act(id, 'cancel', { reason });
export const approveCancellation = (id: string): Promise<unknown> => act(id, 'approve-cancellation');
export const confirmPayment = (id: string): Promise<unknown> => act(id, 'payment/confirm');
export const rejectPayment = (id: string, reason: string): Promise<unknown> => act(id, 'payment/reject', { reason });
export const markCashCollected = (id: string): Promise<unknown> => act(id, 'cash-collected');
export const saveInternalNote = async (id: string, note: string): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/${encodeURIComponent(id)}`, data: { internalNote: note } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
