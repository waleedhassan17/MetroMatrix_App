// MetroMatrix — In-app notification serializer (core).
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import type { AppNotification, NotificationType } from '../types/shopping';
import { bool, isObject, oneOf, str, strOrNull } from './serializerUtils';
import { iso } from './shopping/common';

const TYPES: readonly NotificationType[] = [
  'order_placed',
  'order_update',
  'payment_update',
  'return_update',
  'review_reply',
  'new_order',
  'payment_proof',
  'return_requested',
  'low_stock',
];

export const notificationSerializer = (raw: unknown): AppNotification | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const data = isObject(raw.data) ? raw.data : {};
  return {
    id,
    type: oneOf(raw.type, TYPES, 'order_update'),
    title: str(raw.title),
    body: str(raw.body),
    data: {
      groupCode: strOrNull(data.groupCode),
      orderId: strOrNull(data.orderId),
      returnId: strOrNull(data.returnId),
      productId: strOrNull(data.productId),
    },
    isRead: bool(raw.isRead),
    createdAt: iso(raw.createdAt),
  };
};
