// ═══════════════════════════════════════════════════════
// useFoodLive — Food Court's live screens
// ═══════════════════════════════════════════════════════
// Built from useRealtime. REST is the truth; events are hints:
//   • useOrderChannel — one order (the customer's tracking, the kitchen's
//     order page): joins its room, hands over the new view on
//     `order.updated`, refetches on `order.payment`, moves the rider on
//     `rider.location`; refetches after every reconnect, and polls every
//     motion.trackingPoll while the connection is down.
//   • useVendorBoard — the kitchen's board: `board.sync` (sent on connect),
//     `order.new`, `order.updated` (a card), `order.payment`; refetches
//     after reconnects, polls every motion.boardPoll while down.
//   • useRiderChannel — the rider's deliveries: any `order.updated` in their
//     room reads them again.

import { motion } from '@theme/tokens';
import {
  boardSyncSerializer,
  liveBoardUpdateSerializer,
  liveCustomerUpdateSerializer,
  liveNewOrderSerializer,
  livePaymentSerializer,
  riderFixSerializer,
} from '../serializers/food/liveSerializer';
import { REALTIME_EVENTS } from '../services/realtime/realtimeConfig';
import type { BoardCard, FoodBoardSync, FoodLiveBoardUpdate, FoodLivePayment, FoodOrder, FoodRiderFix } from '../types/food';
import { useLiveFallback, useRealtimeEvent, useRealtimeResync, useRealtimeRoom, useRealtimeStatus } from './useRealtime';

export interface OrderChannelHandlers {
  /** The order's new state (the customer's view), straight from the event. */
  onOrder?: (order: FoodOrder) => void;
  /** The rider moved. */
  onRiderFix?: (fix: FoodRiderFix) => void;
  /** Read the order again over REST. */
  refetch: () => void;
}

/** Live updates for one order while `orderId` is set. */
export const useOrderChannel = (orderId: string | null, h: OrderChannelHandlers) => {
  const enabled = !!orderId;
  const room = useRealtimeRoom(orderId ? `order:${orderId}` : null, orderId ? { orderId } : null);
  useRealtimeEvent(
    REALTIME_EVENTS.orderUpdated,
    raw => {
      const e = liveCustomerUpdateSerializer(raw);
      if (!e || e.orderId !== orderId) return;
      if (e.order && h.onOrder) h.onOrder(e.order);
      else h.refetch();
    },
    enabled,
  );
  useRealtimeEvent(
    REALTIME_EVENTS.orderPayment,
    raw => {
      if (livePaymentSerializer(raw)?.orderId === orderId) h.refetch();
    },
    enabled,
  );
  useRealtimeEvent(
    REALTIME_EVENTS.riderLocation,
    raw => {
      const fix = riderFixSerializer(raw);
      if (fix && fix.orderId === orderId) h.onRiderFix?.(fix);
    },
    enabled,
  );
  useRealtimeResync(h.refetch, enabled);
  useLiveFallback(h.refetch, motion.trackingPoll, enabled);
  return { room, status: useRealtimeStatus() };
};

export interface VendorBoardHandlers {
  onSync: (sync: FoodBoardSync) => void;
  onNew: (card: BoardCard) => void;
  onUpdate: (update: FoodLiveBoardUpdate) => void;
  onPayment: (payment: FoodLivePayment) => void;
  refetch: () => void;
}

/** The kitchen's board, live. */
export const useVendorBoard = (h: VendorBoardHandlers, enabled = true) => {
  useRealtimeEvent(
    REALTIME_EVENTS.boardSync,
    raw => {
      const sync = boardSyncSerializer(raw);
      if (sync) h.onSync(sync);
    },
    enabled,
  );
  useRealtimeEvent(
    REALTIME_EVENTS.orderNew,
    raw => {
      const card = liveNewOrderSerializer(raw);
      if (card) h.onNew(card);
      else h.refetch();
    },
    enabled,
  );
  useRealtimeEvent(
    REALTIME_EVENTS.orderUpdated,
    raw => {
      const e = liveBoardUpdateSerializer(raw);
      if (e) h.onUpdate(e);
    },
    enabled,
  );
  useRealtimeEvent(
    REALTIME_EVENTS.orderPayment,
    raw => {
      const p = livePaymentSerializer(raw);
      if (p) h.onPayment(p);
    },
    enabled,
  );
  useRealtimeResync(h.refetch, enabled);
  useLiveFallback(h.refetch, motion.boardPoll, enabled);
  return useRealtimeStatus();
};

/**
 * The rider's deliveries, live: any change to an order they carry (a new
 * assignment, the kitchen marking it ready, a cancel) reads them again.
 */
export const useRiderChannel = (refetch: () => void, enabled = true) => {
  useRealtimeEvent(REALTIME_EVENTS.orderUpdated, () => refetch(), enabled);
  useRealtimeResync(refetch, enabled);
  useLiveFallback(refetch, motion.trackingPoll, enabled);
  return useRealtimeStatus();
};
