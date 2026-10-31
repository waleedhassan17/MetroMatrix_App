// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Vendor Reviews Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// Reviews of the kitchen, and its replies.
// docs/API_FOOD.md §4.3 Reviews: GET /food/vendor/reviews?unreplied, POST /food/vendor/reviews/:id/reply.

import { api, toApiError, pageParams } from '../../network/apiHelpers';

const enc = encodeURIComponent;

/** `unreplied`: only reviews still waiting for a reply. */
export const getMyReviewsAPI = async (unreplied: boolean, page: number, pageSize: number): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/reviews', { params: { ...(unreplied ? { unreplied: 'true' } : null), ...pageParams(page, pageSize) } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A review theme's reviews (`theme`, `week`: Kitchen Intelligence's additions, TODO(API_KITCHEN)). */
export const getReviewsByThemeAPI = async (theme: string, week: string | null, page: number, pageSize: number): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/reviews', { params: { theme, ...(week ? { week } : null), ...pageParams(page, pageSize) } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const replyToReviewAPI = async (id: string, reply: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/vendor/reviews/${enc(id)}/reply`, { reply: reply.trim() });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
