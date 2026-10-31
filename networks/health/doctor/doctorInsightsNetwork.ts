// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Doctor Insights Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// MetroMatrix-API docs/API_HEALTH.md §4.3 (Insights).

import { api, toApiError } from '../../network/apiHelpers';
import type { DoctorInsightsRange } from '../../../types/health';

export const getInsightsAPI = async (range: DoctorInsightsRange): Promise<unknown> => {
  try {
    const response = await api.get('/health/doctor/insights', { params: { range } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
