// ═══════════════════════════════════════════════════════
// MetroMatrix — Notifications Network (Production API)
// ═══════════════════════════════════════════════════════
// The real API's core notifications (docs/openapi.json): newest first,
// paged; read one at a time or all at once.

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

export const markNotificationReadAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.post(`/notifications/${encodeURIComponent(id)}/read`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const markAllNotificationsReadAPI = async (): Promise<unknown> => {
  try {
    const response = await api.post('/notifications/read-all');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
