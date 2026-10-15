// MetroMatrix — Symptom checker ("Not sure who to see?").
// TODO(API_HEALTH): paths and shapes from docs/API_HEALTH_ASSUMED.md.

import { api } from '../network/apiHelpers';
import { symptomResultSerializer } from '../../serializers/health/recordsSerializer';
import type { Gender } from '../../types/auth';
import { request } from '../shopping/http';

export const checkSymptoms = (input: { text: string; age: number | null; gender: Gender | null }) =>
  request(() => api.post('/healthcare/symptoms/check', input), symptomResultSerializer);
