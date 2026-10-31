// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Reviews Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// Rating an order, and a kitchen's reviews (customer).
// docs/API_FOOD.md §4.2 and §4.1: POST /food/orders/:code/review, GET /food/vendors/:id/reviews.

import { api, toApiError, pageParams } from '../network/apiHelpers';
import type { FoodReviewInput } from '../../types/food';

const enc = encodeURIComponent;

/** Once per order, after it was delivered or collected. The delivery stars go only with a delivery. */
export const reviewFoodOrderAPI = async (code: string, input: FoodReviewInput): Promise<unknown> => {
  try {
    const response = await api.post(`/food/orders/${enc(code)}/review`, {
        foodRating: input.foodRating,
        ...(input.deliveryRating ? { deliveryRating: input.deliveryRating } : null),
        tags: input.tags,
        ...(input.text.trim() ? { text: input.text.trim() } : null),
        photos: input.photos,
      });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Visible reviews, newest first. */
export const getKitchenReviewsAPI = async (vendorId: string, page: number, pageSize: number): Promise<unknown> => {
  try {
    const response = await api.get(`/food/vendors/${enc(vendorId)}/reviews`, { params: pageParams(page, pageSize) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
