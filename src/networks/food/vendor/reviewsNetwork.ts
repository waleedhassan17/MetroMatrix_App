// MetroMatrix — Food vendor: reviews of the kitchen, and its replies.
// docs/API_FOOD.md §4.3 Reviews: GET /food/vendor/reviews?unreplied, POST /food/vendor/reviews/:id/reply.

import { api } from '../../network/apiHelpers';
import { foodReviewSerializer, vendorReviewsPageSerializer } from '../../../serializers/food/reviewSerializer';
import { pageParams, request } from '../../shopping/http';

const enc = encodeURIComponent;

/** `unreplied`: only reviews still waiting for a reply. */
export const listMyReviews = (unreplied: boolean, page: number, pageSize: number) =>
  request(() => api.get('/food/vendor/reviews', { params: { ...(unreplied ? { unreplied: 'true' } : null), ...pageParams(page, pageSize) } }), vendorReviewsPageSerializer);

/** A review theme's reviews (`theme`, `week`: Kitchen Intelligence's additions, TODO(API_KITCHEN)). */
export const listReviewsByTheme = (theme: string, week: string | null, page: number, pageSize: number) =>
  request(() => api.get('/food/vendor/reviews', { params: { theme, ...(week ? { week } : null), ...pageParams(page, pageSize) } }), vendorReviewsPageSerializer);

export const replyToReview = (id: string, reply: string) =>
  request(() => api.post(`/food/vendor/reviews/${enc(id)}/reply`, { reply: reply.trim() }), foodReviewSerializer);
