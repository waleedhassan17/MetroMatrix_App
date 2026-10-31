// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Vendor Insights Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// The kitchen's numbers (recorded sales, never earnings).
// docs/API_FOOD.md §4.3 Insights: GET /food/vendor/insights?range=today|7d|30d.

import { API, toApiError } from '../../network/network';
import type { FoodInsightsRange } from '../../../models/food';

export const fetchFoodInsights = async (range: FoodInsightsRange): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/insights', params: { range } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
