// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Doctor Profile Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// MetroMatrix-API docs/API_HEALTH.md §4.3. The API takes specialty and
// condition ids; the app works in slugs (screens/Health/Doctor/shared/
// practiceReads.ts maps them with referenceIndex).

import { API, toApiError } from '../../network/network';

/** The doctor's own profile (its specialties and conditions by id). */
export const fetchOwnProfile = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/health/doctor/profile' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The fields the form changed, as the API names them (practiceReads `ownProfileBody` builds them). */
export const updateOwnProfile = async (body: Record<string, unknown>): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: '/health/doctor/profile', data: body });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchCompleteness = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/health/doctor/profile/completeness' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Lists the doctor for patients (`422 PROFILE_INCOMPLETE` until the checklist is done); the caller reads the business, now listed. */
export const publishProfile = async (): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/health/doctor/listing/publish', data: {} });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
