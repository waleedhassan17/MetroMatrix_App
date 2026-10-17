// MetroMatrix — The doctor's insights (recorded from their own visits).
// MetroMatrix-API docs/API_HEALTH.md §4.3 (Insights).

import { api } from '../../network/apiHelpers';
import { insightsSerializer } from '../../../serializers/health/doctorSerializer';
import type { DoctorInsightsRange } from '../../../types/health';
import { request } from '../../shopping/http';

export const getInsights = (range: DoctorInsightsRange) =>
  request(() => api.get('/health/doctor/insights', { params: { range } }), insightsSerializer);
