// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Inventory Network (API_SHOPPING.md)
// ═══════════════════════════════════════════════════════
// Stock per variant: the list, a set, a bulk set (all or none), and the
// movements behind a number.

import { API, toApiError, clean, pageParams } from '../../network/network';

const BASE = '/shop/partner/inventory';

export const fetchInventory = async (query: { q?: string; lowStock?: boolean }, page: number, pageSize = 30): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: BASE, params: clean({ ...query, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Answers `{ variantId, stock }`; the movement is recorded as manual. */
export const setStock = async (variantId: string, stock: number): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${BASE}/${encodeURIComponent(variantId)}`, data: { setTo: stock } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Answers `{ updated, items: [{ variantId, stock }] }`. */
export const bulkSetStock = async (variantIds: string[], stock: number): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/bulk`, data: variantIds.map(variantId => ({ variantId, setTo: stock })) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchMovements = async (variantId: string, page = 1, pageSize = 50): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${BASE}/${encodeURIComponent(variantId)}/movements`, params: pageParams(page, pageSize) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
