// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Insights Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Insights (recorded from orders marked delivered).
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { API, toApiError } from '../../network/network';
import type { InsightsRange } from '../../../models/shopping';

export const fetchInsights = async (range: InsightsRange): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/partner/shop/insights', params: { range } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
