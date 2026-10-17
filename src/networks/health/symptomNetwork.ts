// MetroMatrix — Symptom checker ("Not sure who to see?").
// MetroMatrix-API docs/API_HEALTH.md §4.2: red flags first, then a suggested specialty.

import { api } from '../network/apiHelpers';
import { symptomResultSerializer } from '../../serializers/health/recordsSerializer';
import type { Gender } from '../../types/auth';
import { clean, request } from '../shopping/http';

export const checkSymptoms = (input: { text: string; age: number | null; gender: Gender | null }) =>
  request(() => api.post('/health/symptom-checker', clean({ text: input.text, age: input.age, gender: input.gender })), symptomResultSerializer);
