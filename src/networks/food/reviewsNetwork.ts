// MetroMatrix — Food Court: rating an order, and a kitchen's reviews (customer).
// docs/API_FOOD.md §4.2 and §4.1: POST /food/orders/:code/review, GET /food/vendors/:id/reviews.

import { api } from '../network/apiHelpers';
import { foodReviewSerializer, foodReviewsPageSerializer } from '../../serializers/food/reviewSerializer';
import type { FoodReviewInput } from '../../types/food';
import { pageParams, request } from '../shopping/http';

const enc = encodeURIComponent;

/** Once per order, after it was delivered or collected. The delivery stars go only with a delivery. */
export const reviewFoodOrder = (code: string, input: FoodReviewInput) =>
  request(
    () =>
      api.post(`/food/orders/${enc(code)}/review`, {
        foodRating: input.foodRating,
        ...(input.deliveryRating ? { deliveryRating: input.deliveryRating } : null),
        tags: input.tags,
        ...(input.text.trim() ? { text: input.text.trim() } : null),
        photos: input.photos,
      }),
    foodReviewSerializer,
  );

/** Visible reviews, newest first. */
export const listKitchenReviews = (vendorId: string, page: number, pageSize: number) =>
  request(() => api.get(`/food/vendors/${enc(vendorId)}/reviews`, { params: pageParams(page, pageSize) }), foodReviewsPageSerializer);
