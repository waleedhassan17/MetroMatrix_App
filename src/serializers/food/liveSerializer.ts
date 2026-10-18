// ═══════════════════════════════════════════════════════
// MetroMatrix — Food live events → the app's shapes
// ═══════════════════════════════════════════════════════
// What the Food socket sends: order.new and board.sync (board cards),
// order.updated (the customer's view to an order's room, a board card to the
// kitchen), order.payment and rider.location. Events are hints — every
// screen still reads the truth over REST — so anything malformed is null.
// docs/API_FOOD.md §5 (the gateway's events).

import type { FoodBoardSync, FoodLiveBoardUpdate, FoodLiveCustomerUpdate, FoodLiveHead, FoodLivePayment, FoodOrderStatus, FoodRiderFix } from '../../types/food';
import { arr, isObject, num, oneOf, str } from '../serializerUtils';
import { FOOD_ORDER_STATUSES, FOOD_PAYMENT_METHODS, FOOD_PAYMENT_STATUSES, boardCardSerializer, foodOrderSerializer } from './orderSerializer';

const headOf = (raw: unknown): FoodLiveHead | null =>
  isObject(raw) && str(raw.orderId) && FOOD_ORDER_STATUSES.includes(raw.status as FoodOrderStatus)
    ? { orderId: str(raw.orderId), code: str(raw.code), status: raw.status as FoodOrderStatus }
    : null;

/** order.updated in an order's room: the customer's full view. */
export const liveCustomerUpdateSerializer = (raw: unknown): FoodLiveCustomerUpdate | null => {
  const head = headOf(raw);
  return head ? { ...head, order: foodOrderSerializer((raw as Record<string, unknown>).order) } : null;
};

/** order.updated to the kitchen: a board card. */
export const liveBoardUpdateSerializer = (raw: unknown): FoodLiveBoardUpdate | null => {
  const head = headOf(raw);
  return head ? { ...head, order: boardCardSerializer((raw as Record<string, unknown>).order) } : null;
};

/** order.new: the new order's card. */
export const liveNewOrderSerializer = (raw: unknown) => (isObject(raw) ? boardCardSerializer(raw.order) : null);

export const livePaymentSerializer = (raw: unknown): FoodLivePayment | null => {
  const head = headOf(raw);
  if (!head) return null;
  const r = raw as Record<string, unknown>;
  return { ...head, paymentStatus: oneOf(r.paymentStatus, FOOD_PAYMENT_STATUSES, 'cod_pending'), paymentMethod: oneOf(r.paymentMethod, FOOD_PAYMENT_METHODS, 'cod') };
};

export const boardSyncSerializer = (raw: unknown): FoodBoardSync | null =>
  isObject(raw)
    ? {
        at: str(raw.at),
        orders: arr(raw.orders)
          .map(boardCardSerializer)
          .filter((c): c is NonNullable<typeof c> => c !== null),
      }
    : null;

export const riderFixSerializer = (raw: unknown): FoodRiderFix | null => {
  if (!isObject(raw) || !str(raw.orderId)) return null;
  const lat = num(raw.lat, NaN);
  const lng = num(raw.lng, NaN);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const heading = raw.heading === null || raw.heading === undefined ? null : num(raw.heading, NaN);
  return { orderId: str(raw.orderId), lat, lng, heading: heading !== null && Number.isFinite(heading) ? heading : null, at: str(raw.at) };
};
