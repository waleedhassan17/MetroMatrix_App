// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Reviews Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Reviews and replies.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { API, toApiError, clean, pageParams } from '../../network/network';

const BASE = '/partner/shop/reviews';

export const fetchPartnerReviews = async (filter: { rating?: number | null; unreplied?: boolean }, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: BASE, params: clean({ ...filter, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** One reply per review; editable for 24 hours after it is posted. */
export const replyToReview = async (id: string, body: string): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: `${BASE}/${encodeURIComponent(id)}/reply`, data: { body } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
