// MetroMatrix — Reviews of the doctor, and replies.
// TODO(API_HEALTH): paths and shapes from docs/API_HEALTH_ASSUMED.md.

import { api } from '../../network/apiHelpers';
import { doctorReviewSerializer, reviewSummarySerializer } from '../../../serializers/health/discoverySerializer';
import { paged } from '../../../serializers/shopping/common';
import { clean, pageParams, request } from '../../shopping/http';

export const listOwnReviews = (unreplied: boolean, page: number, pageSize = 20) =>
  request(() => api.get('/healthcare/doctor/reviews', { params: clean({ unreplied, ...pageParams(page, pageSize) }) }), raw =>
    paged(raw, doctorReviewSerializer),
  );

export const getOwnReviewSummary = () => request(() => api.get('/healthcare/doctor/reviews/summary'), reviewSummarySerializer);

/** A reply can be edited for 24 hours. */
export const replyToReview = (id: string, text: string) =>
  request(() => api.post(`/healthcare/doctor/reviews/${encodeURIComponent(id)}/reply`, { text }), doctorReviewSerializer);
