// MetroMatrix — Write a review (one per delivered item).
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api } from '../network/apiHelpers';
import { reviewSerializer } from '../../serializers/shopping/catalogSerializer';
import type { ReviewInput } from '../../types/shopping';
import { request } from './http';

export const writeReview = (orderId: string, itemId: string, input: ReviewInput) =>
  request(
    () => api.post(`/shop/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/review`, input),
    reviewSerializer,
  );
