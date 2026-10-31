// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Reviews Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// Rating an order, and a kitchen's reviews (customer).
// docs/API_FOOD.md §4.2 and §4.1: POST /food/orders/:code/review, GET /food/vendors/:id/reviews.

import { API, toApiError, pageParams } from '../network/network';
import type { FoodReviewInput } from '../../models/food';

const enc = encodeURIComponent;

/** Once per order, after it was delivered or collected. The delivery stars go only with a delivery. */
export const reviewFoodOrder = async (code: string, input: FoodReviewInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/orders/${enc(code)}/review`, data: {
        foodRating: input.foodRating,
        ...(input.deliveryRating ? { deliveryRating: input.deliveryRating } : null),
        tags: input.tags,
        ...(input.text.trim() ? { text: input.text.trim() } : null),
        photos: input.photos,
      } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Visible reviews, newest first. */
export const fetchKitchenReviews = async (vendorId: string, page: number, pageSize: number): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendors/${enc(vendorId)}/reviews`, params: pageParams(page, pageSize) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
