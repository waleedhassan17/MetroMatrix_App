// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Vendor Setup Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// The go-live checklist and going live.
// docs/API_FOOD.md §4.3 Setup: GET /food/vendor/setup, POST /food/vendor/go-live (422
// PROFILE_INCOMPLETE with details.missing, or FOOD_SAFETY_CHECK_REQUIRED for
// home kitchens until MetroMatrix's food-safety check).

import { API, toApiError } from '../../network/network';

export const fetchVendorSetup = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/setup' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const goLive = async (): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/go-live' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
