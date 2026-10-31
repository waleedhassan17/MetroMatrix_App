// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Growth Batching Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Orders that could ride with this one.
// docs/API_KITCHEN_ASSUMED.md §2.14, §3.13 (TODO(API_KITCHEN): an assumed contract).

import { API, toApiError } from '../network/network';

export const fetchBatchSuggestions = async (orderId: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendor/orders/${encodeURIComponent(orderId)}/batch-suggestions` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
