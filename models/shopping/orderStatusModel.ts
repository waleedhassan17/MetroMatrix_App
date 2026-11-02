// ═══════════════════════════════════════════════════════
// MetroMatrix — Order, payment and return status (the ONE map)
// ═══════════════════════════════════════════════════════
// Raw status strings never reach the UI: every label, tone and line of
// explanation comes from here, for StatusPill, OrderTimeline and the lists.
//
// Tones are families, the same in the customer's and the store's apps:
//   waiting      warning  placed, a cancel or return asked for, a transfer or refund owed
//   in progress  info     confirmed, packed, a transfer being checked, a return under way
//   on the way   accent   shipped
//   done         success  delivered, paid, refunded to the customer
//   stopped      danger   cancelled, a transfer not found, a return declined
//   neutral               cash on delivery, returned, no payment due

import type {
  CourierKey,
  OrderEventType,
  OrderGroupSummary,
  OrderStatus,
  PartnerOrderRow,
  PartnerOrderSegment,
  PaymentMethod,
  PaymentStatus,
  ReturnStatus,
  StoreOrder,
} from '../shopping';

export type StatusTone = 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger';

export interface StatusMeta {
  label: string;
  tone: StatusTone;
  description: string;
}

export const ORDER_STATUS: Record<OrderStatus, StatusMeta> = {
  placed: { label: 'Placed', tone: 'warning', description: 'The store will confirm your order soon.' },
  confirmed: { label: 'Confirmed', tone: 'info', description: 'The store has accepted your order.' },
  packed: { label: 'Packed', tone: 'info', description: 'Your items are packed and ready to ship.' },
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
  proof_submitted: { label: 'Payment in review', tone: 'info', description: 'The store is checking your transfer.' },
  proof_rejected: { label: 'Payment not received', tone: 'danger', description: 'The store could not find your transfer.' },
  paid: { label: 'Paid', tone: 'success', description: 'The store has confirmed your payment.' },
  cash_collected: { label: 'Paid in cash', tone: 'success', description: 'Cash was collected on delivery.' },
  refund_due: { label: 'Refund due', tone: 'warning', description: 'The store owes you a refund and will record it here.' },
  refunded: { label: 'Refunded', tone: 'neutral', description: 'The store has recorded a refund.' },
  void: { label: 'No payment due', tone: 'neutral', description: 'The order was cancelled before anything was paid.' },
};

export const RETURN_STATUS: Record<ReturnStatus, StatusMeta> = {
  requested: { label: 'Return requested', tone: 'warning', description: 'The store will review your request.' },
  approved: { label: 'Return approved', tone: 'info', description: 'Send the items back as the store instructs.' },
  rejected: { label: 'Return declined', tone: 'danger', description: 'The store declined this return.' },
  received: { label: 'Items received', tone: 'info', description: 'The store has your items back.' },
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
  refunded: 'Refund recorded',
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

/**
 * The ONE pill a store order shows the customer: what they owe beats where
 * the parcel is (a transfer to send or resend, one being checked, a refund
 * coming), then the order's own status.
 */
export const storeOrderHeadline = (o: Pick<StoreOrder, 'status' | 'paymentMethod' | 'paymentStatus'>): StatusMeta => {
  if (needsPayment(o)) return PAYMENT_STATUS[o.paymentStatus];
  if (o.paymentStatus === 'proof_submitted' && o.status !== 'cancelled') return PAYMENT_STATUS.proof_submitted;
  if (o.paymentStatus === 'refund_due') return PAYMENT_STATUS.refund_due;
  return ORDER_STATUS[o.status];
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
  { key: 'delivered', label: 'Delivered' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const PARTNER_CHECK_PAYMENT: StatusMeta = {
  label: 'Check payment',
  tone: 'warning',
  description: 'The customer has sent a transfer. Check your account, then confirm it.',
};

const PARTNER_AWAITING_TRANSFER: StatusMeta = {
  label: 'Awaiting payment',
  tone: 'neutral',
  description: 'The customer has not sent the transfer yet.',
};

/** What each order status asks of the store (its pill keeps the customer's label). */
const PARTNER_ORDER_LINE: Record<OrderStatus, string> = {
  placed: 'New. Confirm it, or cancel it if you can’t fill it.',
  confirmed: 'Confirmed. Pack it next.',
  packed: 'Packed. Ship it with a courier or your own rider.',
  shipped: 'On its way to the customer.',
  delivered: 'Delivered. The customer can still ask to return items within your return window.',
  cancelled: 'This order was cancelled.',
  cancellation_requested: 'The customer asked to cancel. Approve it, or carry on with the order.',
  returned: 'Items from this order came back.',
};

const PARTNER_REFUND_DUE: StatusMeta = {
  ...PAYMENT_STATUS.refund_due,
  description: 'You owe the customer a refund. Send it, then record it here.',
};

/**
 * The ONE pill an order shows in the store's lists: a transfer to check
 * comes first, then a refund the store owes, then a transfer not yet sent,
 * then the order's own status. The line under it speaks to the store.
 */
export const partnerHeadline = (row: Pick<PartnerOrderRow, 'status' | 'paymentMethod' | 'paymentStatus'>): StatusMeta => {
  if (row.status !== 'cancelled' && row.paymentStatus === 'proof_submitted') return PARTNER_CHECK_PAYMENT;
  if (row.paymentStatus === 'refund_due') return PARTNER_REFUND_DUE;
  if (needsPayment(row) && row.paymentStatus === 'awaiting_transfer') return PARTNER_AWAITING_TRANSFER;
  return { ...ORDER_STATUS[row.status], description: PARTNER_ORDER_LINE[row.status] };
};

/** What each return status asks of the store (its pill keeps the shared label). */
const PARTNER_RETURN_LINE: Record<ReturnStatus, string> = {
  requested: 'Approve it with instructions, or decline it with a reason.',
  approved: 'Approved. Mark the items received when they reach you.',
  rejected: 'You declined this return.',
  received: 'The items are back. Send the refund, then record it.',
  refunded: 'Refund recorded. This return is done.',
};

/** A return as the store reads it: the shared pill, a line that speaks to the store. */
export const partnerReturnStatus = (status: ReturnStatus): StatusMeta => ({ ...RETURN_STATUS[status], description: PARTNER_RETURN_LINE[status] });

/** A store order's code is its group's and its place in it: MM-24A7Q2-1 belongs to MM-24A7Q2. */
export const groupCodeOf = (storeOrderCode: string | null | undefined): string | null => storeOrderCode?.match(/^(.+)-\d+$/)?.[1] ?? null;
