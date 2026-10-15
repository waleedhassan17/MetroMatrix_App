// MetroMatrix — Store partner: inventory (per-variant stock and its history).
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api } from '../../network/apiHelpers';
import { compact, paged } from '../../../serializers/shopping/common';
import { inventoryRowSerializer, movementSerializer } from '../../../serializers/shopping/partnerSerializer';
import { arr } from '../../../serializers/serializerUtils';
import { clean, pageParams, request } from '../http';

const BASE = '/partner/shop/inventory';

export const listInventory = (query: { q?: string; lowStock?: boolean }, page: number, pageSize = 30) =>
  request(() => api.get(BASE, { params: clean({ ...query, ...pageParams(page, pageSize) }) }), raw =>
    paged(raw, inventoryRowSerializer),
  );

export const setStock = (variantId: string, stock: number, note: string | null = null) =>
  request(() => api.patch(`${BASE}/${encodeURIComponent(variantId)}`, { stock, note }), inventoryRowSerializer);

export const bulkSetStock = (variantIds: string[], stock: number) =>
  request(() => api.post(`${BASE}/bulk`, { variantIds, stock }), raw => compact(arr(raw).map(inventoryRowSerializer)));

export const listMovements = (variantId: string) =>
  request(() => api.get(`${BASE}/${encodeURIComponent(variantId)}/movements`), raw => compact(arr(raw).map(movementSerializer)));
