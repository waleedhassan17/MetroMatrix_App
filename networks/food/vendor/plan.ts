// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Vendor Plan Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// The plan (always the free Community plan) and
// what it allows. docs/API_FOOD.md §4.3 Plan.

import { API, toApiError } from '../../network/network';

export const fetchVendorPlan = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/plan' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
