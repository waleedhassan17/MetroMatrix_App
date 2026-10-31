// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Doctor Reviews Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// MetroMatrix-API docs/API_HEALTH.md §4.3: a reply is public and replaces an earlier one.

import { api, toApiError, clean, pageParams } from '../../network/apiHelpers';

export const getOwnReviewsAPI = async (unreplied: boolean, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await api.get('/health/doctor/reviews', { params: clean({ unreplied: unreplied ? 'true' : null, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getOwnReviewSummaryAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/health/doctor/reviews/summary');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const replyToReviewAPI = async (id: string, text: string): Promise<unknown> => {
  try {
    const response = await api.post(`/health/doctor/reviews/${encodeURIComponent(id)}/reply`, { text });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
