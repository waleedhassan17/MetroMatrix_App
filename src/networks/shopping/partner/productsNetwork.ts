// MetroMatrix — Store partner: products and collections.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api } from '../../network/apiHelpers';
import { collectionSerializer } from '../../../serializers/shopping/catalogSerializer';
import { compact, paged } from '../../../serializers/shopping/common';
import { partnerProductRowSerializer, partnerProductSerializer } from '../../../serializers/shopping/partnerSerializer';
import { arr } from '../../../serializers/serializerUtils';
import type { PartnerProductInput, PartnerProductStatus } from '../../../types/shopping';
import { ack, clean, pageParams, request } from '../http';

const BASE = '/partner/shop';

export const listPartnerProducts = (
  query: { status: PartnerProductStatus; q?: string; lowStock?: boolean },
  page: number,
  pageSize = 20,
) =>
  request(() => api.get(`${BASE}/products`, { params: clean({ ...query, ...pageParams(page, pageSize) }) }), raw =>
    paged(raw, partnerProductRowSerializer),
  );

export const getPartnerProduct = (id: string) =>
  request(() => api.get(`${BASE}/products/${encodeURIComponent(id)}`), partnerProductSerializer);
export const createPartnerProduct = (input: PartnerProductInput) =>
  request(() => api.post(`${BASE}/products`, input), partnerProductSerializer);
export const updatePartnerProduct = (id: string, input: PartnerProductInput) =>
  request(() => api.patch(`${BASE}/products/${encodeURIComponent(id)}`, input), partnerProductSerializer);
export const setPartnerProductStatus = (id: string, status: PartnerProductStatus) =>
  request(() => api.post(`${BASE}/products/${encodeURIComponent(id)}/status`, { status }), partnerProductSerializer);

// Collections
export const listCollections = () =>
  request(() => api.get(`${BASE}/collections`), raw => compact(arr(raw).map(collectionSerializer)));
export const createCollection = (name: string) =>
  request(() => api.post(`${BASE}/collections`, { name }), collectionSerializer);
export const renameCollection = (id: string, name: string) =>
  request(() => api.patch(`${BASE}/collections/${encodeURIComponent(id)}`, { name }), collectionSerializer);
export const deleteCollection = (id: string) =>
  request(() => api.delete(`${BASE}/collections/${encodeURIComponent(id)}`), ack);
export const reorderCollections = (ids: string[]) =>
  request(() => api.post(`${BASE}/collections/reorder`, { ids }), raw => compact(arr(raw).map(collectionSerializer)));
