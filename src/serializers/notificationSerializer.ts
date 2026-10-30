// MetroMatrix — In-app notification serializer (core).
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import type { AppNotification, NotificationType } from '../types/shopping';
import { bool, isObject, oneOf, str, strOrNull, fromResponse } from './serializerUtils';
import { iso, count, paged } from './shopping/common';

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

const typeOf = (raw: unknown): NotificationType => {
  const t = str(raw);
  if (HEALTH_TYPES[t]) return HEALTH_TYPES[t];
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
      groupCode: strOrNull(data.groupCode),
      orderId: strOrNull(data.orderId),
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

/** GET /notifications/unread-count. */
export const unreadCountSerializer = fromResponse(raw => count(isObject(raw) ? raw.count : raw));
