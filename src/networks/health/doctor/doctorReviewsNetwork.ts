// MetroMatrix — Reviews of the doctor, and replies.
// MetroMatrix-API docs/API_HEALTH.md §4.3: a reply is public and replaces an earlier one.

import { api } from '../../network/apiHelpers';
import { doctorReviewSerializer, reviewSummarySerializer } from '../../../serializers/health/discoverySerializer';
import { paged } from '../../../serializers/shopping/common';
import { clean, pageParams, request } from '../../shopping/http';

export const listOwnReviews = (unreplied: boolean, page: number, pageSize = 20) =>
  request(
    () => api.get('/health/doctor/reviews', { params: clean({ unreplied: unreplied ? 'true' : null, ...pageParams(page, pageSize) }) }),
    raw => paged(raw, doctorReviewSerializer),
  );

export const getOwnReviewSummary = () => request(() => api.get('/health/doctor/reviews/summary'), reviewSummarySerializer);

export const replyToReview = (id: string, text: string) =>
  request(() => api.post(`/health/doctor/reviews/${encodeURIComponent(id)}/reply`, { text }), doctorReviewSerializer);
