// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Growth Demand Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// What people nearby search for, and don't find.
// docs/API_KITCHEN_ASSUMED.md §2.12, §3.12 (TODO(API_KITCHEN): an assumed contract). Anonymous:
// cells with fewer than `minCount` searches are never sent.

import { api, toApiError, clean } from '../network/apiHelpers';

export const getDemandAPI = async (filter: { cuisine?: string | null; hour?: number | null } = {}): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/demand', { params: clean({ cuisine: filter.cuisine, hour: filter.hour ?? undefined }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
