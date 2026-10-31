// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Products Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Products and collections.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api, toApiError, clean, pageParams } from '../../network/apiHelpers';
import type { PartnerProductInput, PartnerProductStatus } from '../../../models/shopping';

const BASE = '/partner/shop';

export const getPartnerProductsAPI = async (query: { status: PartnerProductStatus; q?: string; lowStock?: boolean }, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await api.get(`${BASE}/products`, { params: clean({ ...query, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getPartnerProductAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`${BASE}/products/${encodeURIComponent(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createPartnerProductAPI = async (input: PartnerProductInput): Promise<unknown> => {
  try {
    const response = await api.post(`${BASE}/products`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updatePartnerProductAPI = async (id: string, input: PartnerProductInput): Promise<unknown> => {
  try {
    const response = await api.patch(`${BASE}/products/${encodeURIComponent(id)}`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const setPartnerProductStatusAPI = async (id: string, status: PartnerProductStatus): Promise<unknown> => {
  try {
    const response = await api.post(`${BASE}/products/${encodeURIComponent(id)}/status`, { status });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// Collections
export const getCollectionsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get(`${BASE}/collections`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createCollectionAPI = async (name: string): Promise<unknown> => {
  try {
    const response = await api.post(`${BASE}/collections`, { name });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const renameCollectionAPI = async (id: string, name: string): Promise<unknown> => {
  try {
    const response = await api.patch(`${BASE}/collections/${encodeURIComponent(id)}`, { name });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const deleteCollectionAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`${BASE}/collections/${encodeURIComponent(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const reorderCollectionsAPI = async (ids: string[]): Promise<unknown> => {
  try {
    const response = await api.post(`${BASE}/collections/reorder`, { ids });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
