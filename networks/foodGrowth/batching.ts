// ═══════════════════════════════════════════════════════
// MetroMatrix — Rider Batching Network (docs/API_KITCHEN.md §27)
// ═══════════════════════════════════════════════════════
// Riders for an order, with the other ready orders a rider could take on the
// same trip (`batchWith`: within 2 km and 45°). Assignment stays manual.

import { API, toApiError } from '../network/network';

export const fetchBatchSuggestions = async (orderId: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/riders/suggest', params: { orderId } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
