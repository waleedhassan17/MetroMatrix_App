// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Products Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Products and collections.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { API, toApiError, clean, pageParams } from '../../network/network';
import type { PartnerProductInput, PartnerProductStatus } from '../../../models/shopping';

const BASE = '/partner/shop';

export const fetchPartnerProducts = async (query: { status: PartnerProductStatus; q?: string; lowStock?: boolean }, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/products`, params: clean({ ...query, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchPartnerProduct = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/products/${encodeURIComponent(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createPartnerProduct = async (input: PartnerProductInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/products`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const updatePartnerProduct = async (id: string, input: PartnerProductInput): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/products/${encodeURIComponent(id)}`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const setPartnerProductStatus = async (id: string, status: PartnerProductStatus): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/products/${encodeURIComponent(id)}/status`, data: { status } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

// Collections
export const fetchCollections = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/collections` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const createCollection = async (name: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/collections`, data: { name } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const renameCollection = async (id: string, name: string): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/collections/${encodeURIComponent(id)}`, data: { name } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const deleteCollection = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `${BASE}/collections/${encodeURIComponent(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const reorderCollections = async (ids: string[]): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/collections/reorder`, data: { ids } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
