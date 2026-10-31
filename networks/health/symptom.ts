// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Symptom Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// MetroMatrix-API docs/API_HEALTH.md §4.2: red flags first, then a suggested specialty.

import { API, toApiError, clean } from '../network/network';
import type { Gender } from '../../models/auth';

export const checkSymptoms = async (input: { text: string; age: number | null; gender: Gender | null }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/health/symptom-checker', data: clean({ text: input.text, age: input.age, gender: input.gender }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
