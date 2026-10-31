// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Doctor Insights Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// MetroMatrix-API docs/API_HEALTH.md §4.3 (Insights).

import { API, toApiError } from '../../network/network';
import type { DoctorInsightsRange } from '../../../models/health';

export const fetchInsights = async (range: DoctorInsightsRange): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/health/doctor/insights', params: { range } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
