// MetroMatrix — The doctor's insights (recorded from completed visits).
// TODO(API_HEALTH): paths and shapes from docs/API_HEALTH_ASSUMED.md.

import { api } from '../../network/apiHelpers';
import { insightsSerializer } from '../../../serializers/health/doctorSerializer';
import type { DoctorInsightsRange } from '../../../types/health';
import { request } from '../../shopping/http';

export const getInsights = (range: DoctorInsightsRange) =>
  request(() => api.get('/healthcare/doctor/insights', { params: { range } }), insightsSerializer);
