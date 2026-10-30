// ═══════════════════════════════════════════════════════
// MetroMatrix — Notifications Network (Production API)
// ═══════════════════════════════════════════════════════
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api, toApiError, pageParams } from '../network/apiHelpers';

export const getNotificationsAPI = async (page: number, pageSize = 30): Promise<unknown> => {
  try {
    const response = await api.get('/notifications', { params: pageParams(page, pageSize) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getUnreadCountAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const markNotificationsReadAPI = async (target: { ids: string[] } | { all: true }): Promise<unknown> => {
  try {
    const response = await api.post('/notifications/read', target);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
