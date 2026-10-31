// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Insights Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Insights (recorded from orders marked delivered).
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api, toApiError } from '../../network/apiHelpers';
import type { InsightsRange } from '../../../types/shopping';

export const getInsightsAPI = async (range: InsightsRange): Promise<unknown> => {
  try {
    const response = await api.get('/partner/shop/insights', { params: { range } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
