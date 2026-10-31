// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Doctor Reviews Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// MetroMatrix-API docs/API_HEALTH.md §4.3: a reply is public and replaces an earlier one.

import { API, toApiError, clean, pageParams } from '../../network/network';

export const fetchOwnReviews = async (unreplied: boolean, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/health/doctor/reviews', params: clean({ unreplied: unreplied ? 'true' : null, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchOwnReviewSummary = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/health/doctor/reviews/summary' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const replyToReview = async (id: string, text: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/health/doctor/reviews/${encodeURIComponent(id)}/reply`, data: { text } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
