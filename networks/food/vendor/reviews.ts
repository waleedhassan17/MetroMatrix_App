// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Vendor Reviews Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// Reviews of the kitchen, and its replies.
// docs/API_FOOD.md §4.3 Reviews: GET /food/vendor/reviews?unreplied, POST /food/vendor/reviews/:id/reply.

import { API, toApiError, pageParams } from '../../network/network';

const enc = encodeURIComponent;

/** `unreplied`: only reviews still waiting for a reply. */
export const fetchMyReviews = async (unreplied: boolean, page: number, pageSize: number): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/reviews', params: { ...(unreplied ? { unreplied: 'true' } : null), ...pageParams(page, pageSize) } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A review theme's reviews (`theme`, `week`: Kitchen Intelligence's additions, TODO(API_KITCHEN)). */
export const fetchReviewsByTheme = async (theme: string, week: string | null, page: number, pageSize: number): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/reviews', params: { theme, ...(week ? { week } : null), ...pageParams(page, pageSize) } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const replyToReview = async (id: string, reply: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/reviews/${enc(id)}/reply`, data: { reply: reply.trim() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
