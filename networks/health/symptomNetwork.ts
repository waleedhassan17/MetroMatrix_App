// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Symptom Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// MetroMatrix-API docs/API_HEALTH.md §4.2: red flags first, then a suggested specialty.

import { api, toApiError, clean } from '../network/apiHelpers';
import type { Gender } from '../../models/auth';

export const checkSymptomsAPI = async (input: { text: string; age: number | null; gender: Gender | null }): Promise<unknown> => {
  try {
    const response = await api.post('/health/symptom-checker', clean({ text: input.text, age: input.age, gender: input.gender }));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
