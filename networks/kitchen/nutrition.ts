// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Nutrition Network (docs/API_KITCHEN.md §33)
// ═══════════════════════════════════════════════════════
// Per-dish values (from mapped recipes, or a low-confidence AI estimate),
// the ingredient mapping they come from, and the reference foods.

import { API, toApiError, clean, pageParams } from '../network/network';

const enc = encodeURIComponent;
const N = '/food/vendor/kitchen/nutrition';

export const fetchVendorNutrition = async (page = 1, pageSize = 100): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${N}/items`, params: pageParams(page, pageSize) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A dish's values and how much of its recipe is mapped (recomputed first). */
export const fetchItemNutrition = async (itemId: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${N}/items/${enc(itemId)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** When the recipe can't be used: an AI estimate from the dish's name and portion (capped at 0.4 confidence). */
export const estimateNutrition = async (itemId: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${N}/items/${enc(itemId)}/estimate` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const setNutritionHidden = async (itemId: string, hidden: boolean): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${N}/items/${enc(itemId)}`, data: { hidden } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const searchNutritionFoods = async (q: string, page = 1): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${N}/foods`, params: clean({ q: q.trim(), page }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Each ingredient confirmed, suggested, unmapped or not food. */
export const fetchNutritionMapping = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${N}/mapping` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Confirm a food for an ingredient (null clears it); the dishes are recomputed. */
export const setNutritionMapping = async (ingredientId: string, nutritionFoodId: string | null, pieceGrams?: number | null): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: `${N}/mapping/${enc(ingredientId)}`, data: { nutritionFoodId, ...(pieceGrams ? { pieceGrams } : {}) } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const acceptMappingSuggestions = async (): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${N}/mapping/accept-suggestions` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
