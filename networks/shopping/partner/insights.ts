// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Insights Network (API_SHOPPING.md)
// ═══════════════════════════════════════════════════════
// Insights (recorded from orders marked delivered).

import { API, toApiError } from '../../network/network';
import type { InsightsRange } from '../../../models/shopping';

export const fetchInsights = async (range: InsightsRange): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/shop/partner/insights', params: { range } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
