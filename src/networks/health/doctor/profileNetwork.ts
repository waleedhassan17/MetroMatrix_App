// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Doctor Profile Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// MetroMatrix-API docs/API_HEALTH.md §4.3. The API takes specialty and
// condition ids; the app works in slugs (screens/Health/Doctor/shared/
// practiceReads.ts maps them with referenceIndex).

import { api, toApiError } from '../../network/apiHelpers';

/** The doctor's own profile (its specialties and conditions by id). */
export const getOwnProfileAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/health/doctor/profile');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The fields the form changed, as the API names them (practiceReads `ownProfileBody` builds them). */
export const updateOwnProfileAPI = async (body: Record<string, unknown>): Promise<unknown> => {
  try {
    const response = await api.patch('/health/doctor/profile', body);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getCompletenessAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/health/doctor/profile/completeness');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Lists the doctor for patients (`422 PROFILE_INCOMPLETE` until the checklist is done); the caller reads the business, now listed. */
export const publishProfileAPI = async (): Promise<unknown> => {
  try {
    const response = await api.post('/health/doctor/listing/publish', {});
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
