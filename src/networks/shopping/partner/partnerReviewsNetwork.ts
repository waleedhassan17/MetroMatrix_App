// MetroMatrix — Store partner: reviews and replies.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api } from '../../network/apiHelpers';
import { paged } from '../../../serializers/shopping/common';
import { partnerReviewSerializer } from '../../../serializers/shopping/partnerSerializer';
import { clean, pageParams, request } from '../http';

const BASE = '/partner/shop/reviews';

export const listPartnerReviews = (filter: { rating?: number | null; unreplied?: boolean }, page: number, pageSize = 20) =>
  request(() => api.get(BASE, { params: clean({ ...filter, ...pageParams(page, pageSize) }) }), raw =>
    paged(raw, partnerReviewSerializer),
  );

/** One reply per review; editable for 24 hours after it is posted. */
export const replyToReview = (id: string, body: string) =>
  request(() => api.put(`${BASE}/${encodeURIComponent(id)}/reply`, { body }), partnerReviewSerializer);
