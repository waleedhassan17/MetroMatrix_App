// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Vendor Plan Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// The plan (always the free Community plan) and
// what it allows. docs/API_FOOD.md §4.3 Plan.

import { api, toApiError } from '../../network/apiHelpers';

export const getVendorPlanAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/plan');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
