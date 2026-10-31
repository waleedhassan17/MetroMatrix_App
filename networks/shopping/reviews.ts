// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Reviews Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { API, toApiError } from '../network/network';
import type { ReviewInput } from '../../models/shopping';

export const writeReview = async (orderId: string, itemId: string, input: ReviewInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/shop/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/review`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
