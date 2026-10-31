// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Returns Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Returns.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api, toApiError, clean, pageParams } from '../../network/apiHelpers';
import type { ReturnStatus } from '../../../models/shopping';

const BASE = '/partner/shop/returns';

export const getPartnerReturnsAPI = async (status: ReturnStatus | 'open' | null, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await api.get(BASE, { params: clean({ status, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getPartnerReturnAPI = async (id: string): Promise<unknown> => {
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

export const approveReturnAPI = (id: string, note: string | null): Promise<unknown> => act(id, 'approve', { note });
export const rejectReturnAPI = (id: string, note: string): Promise<unknown> => act(id, 'reject', { note });
/** `restock[orderItemId]` puts that item's quantity back into stock. */
export const receiveReturnAPI = (id: string, restock: Record<string, boolean>): Promise<unknown> => act(id, 'receive', { restock });
export const recordRefundAPI = (id: string, refund: { amount: number; reference: string }): Promise<unknown> => act(id, 'refund', refund);
