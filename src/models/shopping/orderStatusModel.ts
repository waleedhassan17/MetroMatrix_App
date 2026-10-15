// ═══════════════════════════════════════════════════════
// MetroMatrix — Order, payment and return status (the ONE map)
// ═══════════════════════════════════════════════════════
// Raw status strings never reach the UI: every label, tone and line of
// explanation comes from here, for StatusPill, OrderTimeline and the lists.

import type {
  CourierKey,
  OrderEventType,
  OrderGroupSummary,
  OrderStatus,
  PartnerOrderSegment,
  PaymentMethod,
  PaymentStatus,
  ReturnStatus,
  StoreOrder,
} from '../../types/shopping';

export type StatusTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export interface StatusMeta {
  label: string;
  tone: StatusTone;
  description: string;
}

export const ORDER_STATUS: Record<OrderStatus, StatusMeta> = {
  placed: { label: 'Placed', tone: 'accent', description: 'The store will confirm your order soon.' },
  confirmed: { label: 'Confirmed', tone: 'accent', description: 'The store has accepted your order.' },
  packed: { label: 'Packed', tone: 'accent', description: 'Your items are packed and ready to ship.' },
  shipped: { label: 'Shipped', tone: 'accent', description: 'On its way with the courier.' },
  delivered: { label: 'Delivered', tone: 'success', description: 'Delivered to your address.' },
  cancelled: { label: 'Cancelled', tone: 'danger', description: 'This order was cancelled.' },
  cancellation_requested: {
    label: 'Cancellation requested',
    tone: 'warning',
    description: 'The store is reviewing your request to cancel.',
  },
  returned: { label: 'Returned', tone: 'neutral', description: 'Items from this order were returned.' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, StatusMeta> = {
  cod_pending: { label: 'Cash on delivery', tone: 'neutral', description: 'Pay the rider when it arrives.' },
  awaiting_transfer: { label: 'Payment needed', tone: 'warning', description: 'Transfer the amount, then share the transaction ID.' },
  proof_submitted: { label: 'Payment in review', tone: 'accent', description: 'The store is checking your transfer.' },
  proof_rejected: { label: 'Payment not received', tone: 'danger', description: 'The store could not find your transfer.' },
  paid: { label: 'Paid', tone: 'success', description: 'The store has confirmed your payment.' },
  cash_collected: { label: 'Paid in cash', tone: 'success', description: 'Cash was collected on delivery.' },
  refunded: { label: 'Refunded', tone: 'neutral', description: 'The store has recorded a refund.' },
};

export const RETURN_STATUS: Record<ReturnStatus, StatusMeta> = {
  requested: { label: 'Return requested', tone: 'warning', description: 'The store will review your request.' },
  approved: { label: 'Return approved', tone: 'accent', description: 'Send the items back as the store instructs.' },
  rejected: { label: 'Return declined', tone: 'danger', description: 'The store declined this return.' },
  received: { label: 'Items received', tone: 'accent', description: 'The store has your items back.' },
  refunded: { label: 'Refunded', tone: 'success', description: 'The store has recorded your refund.' },
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cod: 'Cash on delivery',
  transfer: 'Bank or wallet transfer',
};

export const COURIERS: { key: CourierKey; name: string }[] = [
  { key: 'tcs', name: 'TCS' },
  { key: 'leopards', name: 'Leopards' },
  { key: 'mnp', name: 'M&P' },
  { key: 'postex', name: 'PostEx' },
  { key: 'trax', name: 'Trax' },
  { key: 'own_rider', name: 'Own rider' },
  { key: 'other', name: 'Other' },
];

export const courierName = (key: CourierKey): string => COURIERS.find(c => c.key === key)?.name ?? 'Courier';

const EVENT_LABEL: Record<OrderEventType, string> = {
  placed: 'Order placed',
  confirmed: 'Confirmed by the store',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  cancellation_requested: 'Cancellation requested',
  returned: 'Returned',
  payment_proof_submitted: 'Payment details sent',
  payment_confirmed: 'Payment confirmed',
  payment_rejected: 'Payment not received',
  cash_collected: 'Cash collected',
  return_requested: 'Return requested',
};

export const eventLabel = (type: OrderEventType): string => EVENT_LABEL[type] ?? 'Update';

/** Does this order need the customer to pay before the store can ship? */
export const needsPayment = (o: { paymentMethod: PaymentMethod; paymentStatus: PaymentStatus; status: OrderStatus }) =>
  o.paymentMethod === 'transfer' &&
  (o.paymentStatus === 'awaiting_transfer' || o.paymentStatus === 'proof_rejected') &&
  o.status !== 'cancelled';

/**
 * The one status a multi-store order shows in a list: the most urgent one.
 * Payment the customer owes beats everything; then anything still moving,
 * least advanced first; finished states last.
 */
const URGENCY: OrderStatus[] = [
  'cancellation_requested',
  'placed',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'returned',
  'cancelled',
];

export const groupHeadline = (orders: OrderGroupSummary['orders']): StatusMeta => {
  if (orders.some(needsPayment)) return PAYMENT_STATUS.awaiting_transfer;
  if (orders.some(o => o.paymentStatus === 'proof_submitted' && o.status !== 'cancelled')) {
    return PAYMENT_STATUS.proof_submitted;
  }
  const ranked = [...orders].sort((a, b) => URGENCY.indexOf(a.status) - URGENCY.indexOf(b.status));
  return ORDER_STATUS[ranked[0]?.status ?? 'placed'];
};

export type TimelineState = 'done' | 'current' | 'upcoming' | 'failed';

export interface TimelineStepView {
  label: string;
  description?: string;
  state: TimelineState;
}

const MAIN_PATH: OrderStatus[] = ['placed', 'confirmed', 'packed', 'shipped', 'delivered'];

/**
 * The order's journey for StatusTimeline: the five main steps with the time
 * each was reached, the courier on "Shipped", and a final failed step when
 * the order was cancelled.
 */
export const orderTimeline = (
  order: Pick<StoreOrder, 'status' | 'events' | 'shipment'>,
  formatTime: (iso: string) => string,
): TimelineStepView[] => {
  const firstAt = (type: OrderEventType) => order.events.find(e => e.type === type)?.createdAt;
  const describe = (status: OrderStatus) => {
    const at = firstAt(status);
    const time = at ? formatTime(at) : undefined;
    if (status === 'shipped' && order.shipment) {
      return [order.shipment.courierName, order.shipment.trackingRef, time].filter(Boolean).join(' · ');
    }
    return time;
  };

  // Cancelled: the steps it actually reached, then the cancellation.
  if (order.status === 'cancelled') {
    const reached = MAIN_PATH.filter(s => firstAt(s));
    return [
      ...reached.map(s => ({ label: EVENT_LABEL[s], description: describe(s), state: 'done' as const })),
      { label: EVENT_LABEL.cancelled, description: describe('cancelled'), state: 'failed' as const },
    ];
  }

  // Otherwise the five main steps, up to where the order is now.
  const progress: OrderStatus =
    order.status === 'returned'
      ? 'delivered'
      : order.status === 'cancellation_requested'
        ? ([...MAIN_PATH].reverse().find(s => firstAt(s)) ?? 'placed')
        : order.status;
  const index = MAIN_PATH.indexOf(progress);
  const steps: TimelineStepView[] = MAIN_PATH.map((s, i) => ({
    label: EVENT_LABEL[s],
    description: describe(s),
    state: i < index || (i === index && s === 'delivered') ? 'done' : i === index ? 'current' : 'upcoming',
  }));
  if (order.status === 'cancellation_requested') {
    steps.splice(index + 1, 0, { label: EVENT_LABEL.cancellation_requested, description: describe('cancellation_requested'), state: 'current' });
  }
  if (order.status === 'returned') {
    steps.push({ label: EVENT_LABEL.returned, description: describe('returned'), state: 'done' });
  }
  return steps;
};

// ─── Store partner ────────────────────────────────────
export const PARTNER_SEGMENTS: { key: PartnerOrderSegment; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'to_pack', label: 'To pack' },
  { key: 'to_ship', label: 'To ship' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'done', label: 'Done' },
  { key: 'cancelled', label: 'Cancelled' },
];

/** The partner segment an order sits in (mirrors the API's grouping). */
export const partnerSegmentOf = (status: OrderStatus): PartnerOrderSegment => {
  switch (status) {
    case 'placed':
    case 'cancellation_requested':
      return 'new';
    case 'confirmed':
      return 'to_pack';
    case 'packed':
      return 'to_ship';
    case 'shipped':
      return 'shipped';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'done';
  }
};
