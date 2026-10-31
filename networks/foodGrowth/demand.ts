// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Growth Demand Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// What people nearby search for, and don't find.
// docs/API_KITCHEN_ASSUMED.md §2.12, §3.12 (TODO(API_KITCHEN): an assumed contract). Anonymous:
// cells with fewer than `minCount` searches are never sent.

import { API, toApiError, clean } from '../network/network';

export const fetchDemand = async (filter: { cuisine?: string | null; hour?: number | null } = {}): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/demand', params: clean({ cuisine: filter.cuisine, hour: filter.hour ?? undefined }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
