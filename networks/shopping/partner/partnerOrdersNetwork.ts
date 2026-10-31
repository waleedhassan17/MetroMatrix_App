// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Orders Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Orders and their actions.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api, toApiError, clean, pageParams } from '../../network/apiHelpers';
import type { CourierKey, PartnerOrderSegment } from '../../../models/shopping';

const BASE = '/partner/shop/orders';

/** `payment: 'proof_submitted'` lists every order with a transfer to check, across segments. */
export const getPartnerOrdersAPI = async (query: { segment: PartnerOrderSegment; q?: string; payment?: 'proof_submitted' }, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await api.get(BASE, { params: clean({ ...query, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getPartnerOrderAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`${BASE}/${encodeURIComponent(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

const act = async (id: string, action: string, body?: object): Promise<unknown> => {
  try {
    const response = await api.post(`${BASE}/${encodeURIComponent(id)}/${action}`, body ?? {});
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const confirmOrderAPI = (id: string): Promise<unknown> => act(id, 'confirm');
export const packOrderAPI = (id: string): Promise<unknown> => act(id, 'pack');
export const shipOrderAPI = (id: string, shipment: { courier: CourierKey; trackingRef: string }): Promise<unknown> => act(id, 'ship', shipment);
export const deliverOrderAPI = (id: string): Promise<unknown> => act(id, 'deliver');
export const cancelPartnerOrderAPI = (id: string, reason: string): Promise<unknown> => act(id, 'cancel', { reason });
export const approveCancellationAPI = (id: string): Promise<unknown> => act(id, 'approve-cancellation');
export const confirmPaymentAPI = (id: string): Promise<unknown> => act(id, 'payment/confirm');
export const rejectPaymentAPI = (id: string, reason: string): Promise<unknown> => act(id, 'payment/reject', { reason });
export const markCashCollectedAPI = (id: string): Promise<unknown> => act(id, 'cash-collected');
export const saveInternalNoteAPI = async (id: string, note: string): Promise<unknown> => {
  try {
    const response = await api.patch(`${BASE}/${encodeURIComponent(id)}`, { internalNote: note });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
