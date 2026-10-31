// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Reviews Network (API_SHOPPING.md)
// ═══════════════════════════════════════════════════════
// The store's reviews (all, or the ones it hasn't answered) and its reply.

import { API, toApiError, clean, pageParams } from '../../network/network';

const BASE = '/shop/partner/reviews';

export const fetchPartnerReviews = async (filter: { unreplied?: boolean }, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: BASE, params: clean({ ...filter, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** One reply per review; editable for 24 hours after it is posted. */
export const replyToReview = async (id: string, text: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${BASE}/${encodeURIComponent(id)}/reply`, data: { text } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
