// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Reviews Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api, toApiError } from '../network/apiHelpers';
import type { ReviewInput } from '../../types/shopping';

export const writeReviewAPI = async (orderId: string, itemId: string, input: ReviewInput): Promise<unknown> => {
  try {
    const response = await api.post(`/shop/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/review`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
