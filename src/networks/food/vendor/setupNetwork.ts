// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Vendor Setup Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// The go-live checklist and going live.
// docs/API_FOOD.md §4.3 Setup: GET /food/vendor/setup, POST /food/vendor/go-live (422
// PROFILE_INCOMPLETE with details.missing, or FOOD_SAFETY_CHECK_REQUIRED for
// home kitchens until MetroMatrix's food-safety check).

import { api, toApiError } from '../../network/apiHelpers';

export const getVendorSetupAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/setup');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const goLiveAPI = async (): Promise<unknown> => {
  try {
    const response = await api.post('/food/vendor/go-live');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
