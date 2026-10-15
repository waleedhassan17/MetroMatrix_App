// MetroMatrix — Store partner: returns.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api } from '../../network/apiHelpers';
import { paged } from '../../../serializers/shopping/common';
import { returnSerializer } from '../../../serializers/shopping/orderSerializer';
import type { ReturnStatus } from '../../../types/shopping';
import { clean, pageParams, request } from '../http';

const BASE = '/partner/shop/returns';

export const listPartnerReturns = (status: ReturnStatus | 'open' | null, page: number, pageSize = 20) =>
  request(() => api.get(BASE, { params: clean({ status, ...pageParams(page, pageSize) }) }), raw => paged(raw, returnSerializer));

export const getPartnerReturn = (id: string) => request(() => api.get(`${BASE}/${encodeURIComponent(id)}`), returnSerializer);

const act = (id: string, action: string, body?: object) =>
  request(() => api.post(`${BASE}/${encodeURIComponent(id)}/${action}`, body ?? {}), returnSerializer);

export const approveReturn = (id: string, note: string | null) => act(id, 'approve', { note });
export const rejectReturn = (id: string, note: string) => act(id, 'reject', { note });
/** `restock[orderItemId]` puts that item's quantity back into stock. */
export const receiveReturn = (id: string, restock: Record<string, boolean>) => act(id, 'receive', { restock });
export const recordRefund = (id: string, refund: { amount: number; reference: string }) => act(id, 'refund', refund);
