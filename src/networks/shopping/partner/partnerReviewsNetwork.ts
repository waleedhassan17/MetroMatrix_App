// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Partner Reviews Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Reviews and replies.
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api, toApiError, clean, pageParams } from '../../network/apiHelpers';

const BASE = '/partner/shop/reviews';

export const getPartnerReviewsAPI = async (filter: { rating?: number | null; unreplied?: boolean }, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await api.get(BASE, { params: clean({ ...filter, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** One reply per review; editable for 24 hours after it is posted. */
export const replyToReviewAPI = async (id: string, body: string): Promise<unknown> => {
  try {
    const response = await api.put(`${BASE}/${encodeURIComponent(id)}/reply`, { body });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
