// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Returns Network (API_SHOPPING.md)
// ═══════════════════════════════════════════════════════
// The store's returns by status, one return, and its decisions: approve,
// reject, receive (restocking per line), record the refund.

import { API, toApiError, clean, pageParams } from '../../network/network';
import type { ReturnStatus } from '../../../models/shopping';

const BASE = '/shop/partner/returns';

export const fetchPartnerReturns = async (status: ReturnStatus | null, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: BASE, params: clean({ status, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchPartnerReturn = async (id: string): Promise<unknown> => {
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

export const approveReturn = (id: string, note: string | null): Promise<unknown> => act(id, 'approve', note?.trim() ? { note: note.trim() } : {});
export const rejectReturn = (id: string, note: string): Promise<unknown> => act(id, 'reject', { note: note.trim() });
/** `restock[returnItemId]` puts that line's quantity back into stock. */
export const receiveReturn = (id: string, restock: Record<string, boolean>): Promise<unknown> =>
  act(id, 'receive', { items: Object.entries(restock).map(([returnItemId, back]) => ({ returnItemId, restock: back })) });
export const recordRefund = (id: string, refund: { amount: number; reference: string }): Promise<unknown> =>
  act(id, 'refund', { amount: refund.amount, refundRef: refund.reference.trim() });
