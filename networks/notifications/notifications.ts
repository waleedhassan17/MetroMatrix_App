// ═══════════════════════════════════════════════════════
// MetroMatrix — Notifications Network (Production API)
// ═══════════════════════════════════════════════════════
// The real API's core notifications (docs/openapi.json): newest first,
// paged; read one at a time or all at once.

import { API, toApiError, pageParams } from '../network/network';

export const fetchNotifications = async (page: number, pageSize = 30): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/notifications', params: pageParams(page, pageSize) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchUnreadCount = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/notifications/unread-count' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const markNotificationRead = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/notifications/${encodeURIComponent(id)}/read` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const markAllNotificationsRead = async (): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/notifications/read-all' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
