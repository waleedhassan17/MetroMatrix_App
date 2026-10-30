// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Growth Batching Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Orders that could ride with this one.
// docs/API_KITCHEN_ASSUMED.md §2.14, §3.13 (TODO(API_KITCHEN): an assumed contract).

import { api, toApiError } from '../network/apiHelpers';

export const getBatchSuggestionsAPI = async (orderId: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/vendor/orders/${encodeURIComponent(orderId)}/batch-suggestions`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
