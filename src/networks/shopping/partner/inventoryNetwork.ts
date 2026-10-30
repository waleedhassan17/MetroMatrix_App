// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Inventory Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Inventory (per-variant stock and its history).
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api, toApiError, clean, pageParams } from '../../network/apiHelpers';

const BASE = '/partner/shop/inventory';

export const getInventoryAPI = async (query: { q?: string; lowStock?: boolean }, page: number, pageSize = 30): Promise<unknown> => {
  try {
    const response = await api.get(BASE, { params: clean({ ...query, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const setStockAPI = async (variantId: string, stock: number, note: string | null = null): Promise<unknown> => {
  try {
    const response = await api.patch(`${BASE}/${encodeURIComponent(variantId)}`, { stock, note });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const bulkSetStockAPI = async (variantIds: string[], stock: number): Promise<unknown> => {
  try {
    const response = await api.post(`${BASE}/bulk`, { variantIds, stock });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getMovementsAPI = async (variantId: string): Promise<unknown> => {
  try {
    const response = await api.get(`${BASE}/${encodeURIComponent(variantId)}/movements`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
