// MetroMatrix — In-app notifications network (core).
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api } from '../network/apiHelpers';
import { notificationSerializer } from '../../serializers/notificationSerializer';
import { count, paged } from '../../serializers/shopping/common';
import { isObject } from '../../serializers/serializerUtils';
import { ack, pageParams, request } from '../shopping/http';

export const listNotifications = (page: number, pageSize = 30) =>
  request(() => api.get('/notifications', { params: pageParams(page, pageSize) }), raw => paged(raw, notificationSerializer));

export const getUnreadCount = () =>
  request(() => api.get('/notifications/unread-count'), raw => count(isObject(raw) ? raw.count : raw));

export const markNotificationsRead = (target: { ids: string[] } | { all: true }) =>
  request(() => api.post('/notifications/read', target), ack);
