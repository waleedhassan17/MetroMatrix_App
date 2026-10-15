// MetroMatrix — Store partner: orders and their actions.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api } from '../../network/apiHelpers';
import { paged } from '../../../serializers/shopping/common';
import { partnerOrderDetailSerializer, partnerOrderRowSerializer } from '../../../serializers/shopping/partnerSerializer';
import { isObject, num } from '../../../serializers/serializerUtils';
import type { CourierKey, PartnerOrderSegment } from '../../../types/shopping';
import { clean, pageParams, request } from '../http';

const BASE = '/partner/shop/orders';

/** `payment: 'proof_submitted'` lists every order with a transfer to check, across segments. */
export const listPartnerOrders = (
  query: { segment: PartnerOrderSegment; q?: string; payment?: 'proof_submitted' },
  page: number,
  pageSize = 20,
) =>
  request(() => api.get(BASE, { params: clean({ ...query, ...pageParams(page, pageSize) }) }), raw => ({
    ...paged(raw, partnerOrderRowSerializer),
    segmentCounts: isObject(raw) && isObject(raw.segmentCounts)
      ? (Object.fromEntries(Object.entries(raw.segmentCounts).map(([k, v]) => [k, Math.max(0, Math.round(num(v)))])) as Record<
          PartnerOrderSegment,
          number
        >)
      : null,
  }));

export const getPartnerOrder = (id: string) =>
  request(() => api.get(`${BASE}/${encodeURIComponent(id)}`), partnerOrderDetailSerializer);

const act = (id: string, action: string, body?: object) =>
  request(() => api.post(`${BASE}/${encodeURIComponent(id)}/${action}`, body ?? {}), partnerOrderDetailSerializer);

export const confirmOrder = (id: string) => act(id, 'confirm');
export const packOrder = (id: string) => act(id, 'pack');
export const shipOrder = (id: string, shipment: { courier: CourierKey; trackingRef: string }) => act(id, 'ship', shipment);
export const deliverOrder = (id: string) => act(id, 'deliver');
export const cancelPartnerOrder = (id: string, reason: string) => act(id, 'cancel', { reason });
export const approveCancellation = (id: string) => act(id, 'approve-cancellation');
export const confirmPayment = (id: string) => act(id, 'payment/confirm');
export const rejectPayment = (id: string, reason: string) => act(id, 'payment/reject', { reason });
export const markCashCollected = (id: string) => act(id, 'cash-collected');
export const saveInternalNote = (id: string, note: string) =>
  request(() => api.patch(`${BASE}/${encodeURIComponent(id)}`, { internalNote: note }), partnerOrderDetailSerializer);
