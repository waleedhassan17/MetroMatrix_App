// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Nutrition Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// What each dish holds, worked out from its recipe card
// and the nutrition foods its ingredients map to (or estimated from its name).
// docs/API_KITCHEN_ASSUMED.md §4.7 (TODO(API_KITCHEN): an assumed contract).

import { api, toApiError } from '../network/apiHelpers';

export const getVendorNutritionAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/nutrition');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Hidden: customers don't see this dish's numbers. */
export const setNutritionHiddenAPI = async (itemId: string, hidden: boolean): Promise<unknown> => {
  try {
    const response = await api.patch(`/food/vendor/nutrition/${encodeURIComponent(itemId)}`, { hidden });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const searchNutritionFoodsAPI = async (q: string): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/kitchen/nutrition-foods', { params: { q: q.trim() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The ordinary ingredient edit. */
