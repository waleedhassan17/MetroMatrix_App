// MetroMatrix — In-app notification serializer (core): MetroMatrix-API's
// notification view `{ id, type, title, body, data, readAt, createdAt }`.

import type { AppNotification, NotificationType } from '../models/shopping';
import { bool, isObject, oneOf, str, strOrNull, fromResponse } from './serializerUtils';
import { iso, count, paged } from './shopping/common';
import { groupCodeOf } from '../models/shopping/orderStatusModel';

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
  'appointment_update',
  'appointment_reminder',
  'appointment_new',
  'appointment_payment',
  'prescription_ready',
  'review_new',
];

/**
 * Health notices as MetroMatrix-API docs/API_HEALTH.md §6 names them
 * (`health.appointment.booked`, …) → the app's kinds (icon and wording).
 */
const HEALTH_TYPES: Record<string, NotificationType> = {
  'health.appointment.new': 'appointment_new',
  'health.appointment.reminder': 'appointment_reminder',
  'health.payment.proof': 'appointment_payment',
  'health.payment.confirmed': 'appointment_payment',
  'health.payment.rejected': 'appointment_payment',
  'health.payment.refunded': 'appointment_payment',
  'health.prescription': 'prescription_ready',
  'health.review.new': 'review_new',
  'health.review.reply': 'review_reply',
};

/** Shopping notices as MetroMatrix-API names them (`shop.order.shipped`, …) → the app's kinds. */
const SHOP_TYPES: Record<string, NotificationType> = {
  'shop.order.placed': 'order_placed',
  'shop.order.new': 'new_order',
  'shop.payment.proof': 'payment_proof',
  'shop.payment.confirmed': 'payment_update',
  'shop.payment.rejected': 'payment_update',
  'shop.payment.refunded': 'payment_update',
  'shop.return.requested': 'return_requested',
  'shop.return.approved': 'return_update',
  'shop.return.rejected': 'return_update',
  'shop.return.refunded': 'return_update',
  'shop.review.new': 'review_new',
  'shop.inventory.low_stock': 'low_stock',
};

const typeOf = (raw: unknown): NotificationType => {
  const t = str(raw);
  if (HEALTH_TYPES[t]) return HEALTH_TYPES[t];
  if (SHOP_TYPES[t]) return SHOP_TYPES[t];
  if (t.startsWith('shop.')) return 'order_update';
  if (t.startsWith('health.appointment.')) return 'appointment_update';
  return oneOf(t, TYPES, 'order_update');
};

export const notificationSerializer = (raw: unknown): AppNotification | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const data = isObject(raw.data) ? raw.data : {};
  return {
    id,
    type: typeOf(raw.type),
    title: str(raw.title),
    body: str(raw.body),
    data: {
      // Shopping notices name the store order (`storeOrderId`, `code`); its group's code is the code's prefix.
      groupCode: strOrNull(data.groupCode) ?? groupCodeOf(strOrNull(data.code)),
      orderId: strOrNull(data.orderId) ?? strOrNull(data.storeOrderId),
      returnId: strOrNull(data.returnId),
      productId: strOrNull(data.productId),
      // Health notices carry the appointment's code; the doctor app opens appointments by code too.
      appointmentCode: strOrNull(data.appointmentCode),
      appointmentId: strOrNull(data.appointmentId) ?? strOrNull(data.appointmentCode),
      prescriptionId: strOrNull(data.prescriptionId),
    },
    isRead: bool(raw.isRead) || !!strOrNull(raw.readAt),
    createdAt: iso(raw.createdAt),
  };
};

/** GET /notifications: a page of notifications. */
export const notificationPageSerializer = fromResponse(raw => paged(raw, notificationSerializer));

/** GET /notifications/unread-count → `{ unread }`. */
export const unreadCountSerializer = fromResponse(raw => count(isObject(raw) ? (raw.unread ?? raw.count) : raw));
