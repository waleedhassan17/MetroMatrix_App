// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Inventory Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Inventory (per-variant stock and its history).
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { API, toApiError, clean, pageParams } from '../../network/network';

const BASE = '/partner/shop/inventory';

export const fetchInventory = async (query: { q?: string; lowStock?: boolean }, page: number, pageSize = 30): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: BASE, params: clean({ ...query, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const setStock = async (variantId: string, stock: number, note: string | null = null): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/${encodeURIComponent(variantId)}`, data: { stock, note } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const bulkSetStock = async (variantIds: string[], stock: number): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/bulk`, data: { variantIds, stock } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchMovements = async (variantId: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/${encodeURIComponent(variantId)}/movements` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
