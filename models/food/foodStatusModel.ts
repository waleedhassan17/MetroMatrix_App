// ═══════════════════════════════════════════════════════
// MetroMatrix — Food order wording (the ONE map)
// ═══════════════════════════════════════════════════════
// How an order, its payment and its rider's step are said, to the customer,
// the vendor and the rider; the tracking steps; the vendor board's columns;
// accept-time and decline-reason choices. Money is always paid to the vendor
// directly; nothing implies a MetroMatrix cut or MetroMatrix riders.
//
// Tones are Shopping's families (models/shopping/orderStatusModel), the same
// in the customer's, the kitchen's and the rider's apps:
//   waiting      warning  placed, a transfer to send, a refund owed
//   in progress  info     accepted, cooking, ready, a receipt being checked
//   on the way   accent   out for delivery
//   done         success  delivered, collected, paid
//   stopped      danger   declined, missed, cancelled
//   neutral               cash on delivery, pay at pickup, nothing to pay
// Every row and card shows ONE pill: foodOrderHeadline, ticketHeadline,
// riderDeliveryHeadline pick it.

import type { FoodFulfilment, FoodOrderStatus, FoodPaymentMethod, FoodPaymentStatus, RiderStep } from '../food';

export type Tone = 'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'danger';

export const ORDER_STATUS: Record<FoodOrderStatus, { label: string; vendorLabel: string; tone: Tone }> = {
  placed: { label: 'Waiting for the kitchen', vendorLabel: 'New', tone: 'warning' },
  accepted: { label: 'Accepted', vendorLabel: 'Accepted', tone: 'info' },
  preparing: { label: 'Being prepared', vendorLabel: 'Cooking', tone: 'info' },
  ready: { label: 'Ready', vendorLabel: 'Ready', tone: 'info' },
  on_the_way: { label: 'On the way', vendorLabel: 'Out for delivery', tone: 'accent' },
  delivered: { label: 'Delivered', vendorLabel: 'Delivered', tone: 'success' },
  picked_up: { label: 'Collected', vendorLabel: 'Collected', tone: 'success' },
  rejected: { label: 'Declined by the kitchen', vendorLabel: 'Declined', tone: 'danger' },
  auto_rejected: { label: 'Not accepted in time', vendorLabel: 'Missed', tone: 'danger' },
  cancelled: { label: 'Cancelled', vendorLabel: 'Cancelled', tone: 'danger' },
};

export const orderStatusLabel = (s: FoodOrderStatus, fulfilment: FoodFulfilment = 'delivery') =>
  s === 'ready' && fulfilment === 'pickup' ? 'Ready to collect' : ORDER_STATUS[s].label;

export const ENDED: FoodOrderStatus[] = ['delivered', 'picked_up', 'rejected', 'auto_rejected', 'cancelled'];
export const isEnded = (s: FoodOrderStatus) => ENDED.includes(s);
export const isNegativeEnd = (s: FoodOrderStatus) => s === 'rejected' || s === 'auto_rejected' || s === 'cancelled';

/** The tracking steps, in order. */
export const PROGRESS: Record<FoodFulfilment, { status: FoodOrderStatus; label: string }[]> = {
  delivery: [
    { status: 'placed', label: 'Order placed' },
    { status: 'accepted', label: 'Accepted' },
    { status: 'preparing', label: 'Being prepared' },
    { status: 'on_the_way', label: 'On the way' },
    { status: 'delivered', label: 'Delivered' },
  ],
  pickup: [
    { status: 'placed', label: 'Order placed' },
    { status: 'accepted', label: 'Accepted' },
    { status: 'preparing', label: 'Being prepared' },
    { status: 'ready', label: 'Ready to collect' },
    { status: 'picked_up', label: 'Collected' },
  ],
};

/** How far along the steps an order is (the index of the last step reached). */
export const progressIndex = (s: FoodOrderStatus, fulfilment: FoodFulfilment) => {
  const order: FoodOrderStatus[] = ['placed', 'accepted', 'preparing', 'ready', fulfilment === 'delivery' ? 'on_the_way' : 'picked_up', 'delivered'];
  const steps = PROGRESS[fulfilment].map(p => p.status);
  const at = order.indexOf(s);
  let i = -1;
  steps.forEach((st, n) => {
    if (order.indexOf(st) <= at) i = n;
  });
  return i;
};

export const PAYMENT_METHOD: Record<FoodPaymentMethod, { label: string; hint: string }> = {
  cod: { label: 'Cash on delivery', hint: 'Pay the rider when your food arrives' },
  transfer: { label: 'Bank or wallet transfer', hint: 'Send it to the kitchen’s own account, then add the receipt' },
  pay_at_pickup: { label: 'Pay at pickup', hint: 'Pay at the counter when you collect' },
  tiffin_plan: { label: 'Tiffin plan', hint: 'Paid with your tiffin period, directly to the kitchen' },
};

/** `pill` is the short form a StatusPill shows; `label` the sentence a card says. */
export const PAYMENT_STATUS: Record<FoodPaymentStatus, { label: string; pill: string; vendorLabel: string; tone: Tone }> = {
  cod_pending: { label: 'Cash on delivery', pill: 'Cash on delivery', vendorLabel: 'Cash on delivery', tone: 'neutral' },
  unpaid: { label: 'Pay at pickup', pill: 'Pay at pickup', vendorLabel: 'Pays at pickup', tone: 'neutral' },
  awaiting_transfer: { label: 'Waiting for your transfer', pill: 'Send the transfer', vendorLabel: 'Waiting for transfer', tone: 'warning' },
  proof_submitted: { label: 'Receipt sent, waiting for the kitchen', pill: 'Receipt being checked', vendorLabel: 'Check the transfer', tone: 'info' },
  paid: { label: 'Paid', pill: 'Paid', vendorLabel: 'Paid', tone: 'success' },
  void: { label: 'Nothing to pay', pill: 'Nothing to pay', vendorLabel: 'No payment', tone: 'neutral' },
  refund_due: { label: 'The kitchen owes you a refund', pill: 'Refund due', vendorLabel: 'Refund due', tone: 'warning' },
  refunded: { label: 'Refunded', pill: 'Refunded', vendorLabel: 'Refunded', tone: 'neutral' },
};

export interface FoodHeadline {
  label: string;
  tone: Tone;
}

type HeadlineOrder = { status: FoodOrderStatus; fulfilment: FoodFulfilment; payment: { method: FoodPaymentMethod; status: FoodPaymentStatus } };

/**
 * The ONE pill a customer's order shows: what the customer owes beats where
 * the food is (a transfer to send, a receipt being checked, a refund coming),
 * then the order's own step.
 */
export const foodOrderHeadline = (o: HeadlineOrder): FoodHeadline => {
  const ended = isEnded(o.status);
  if (!ended && o.payment.status === 'awaiting_transfer') return { label: PAYMENT_STATUS.awaiting_transfer.pill, tone: 'warning' };
  if (!ended && o.payment.status === 'proof_submitted') return { label: PAYMENT_STATUS.proof_submitted.pill, tone: 'info' };
  if (o.payment.status === 'refund_due') return { label: PAYMENT_STATUS.refund_due.pill, tone: 'warning' };
  return { label: orderStatusLabel(o.status, o.fulfilment), tone: ORDER_STATUS[o.status].tone };
};

/** The ONE pill on a kitchen's ticket: a transfer to check beats the step. */
export const ticketHeadline = (o: HeadlineOrder): FoodHeadline => {
  if (!isEnded(o.status) && o.payment.status === 'proof_submitted') return { label: PAYMENT_STATUS.proof_submitted.vendorLabel, tone: 'info' };
  if (o.payment.status === 'refund_due') return { label: PAYMENT_STATUS.refund_due.vendorLabel, tone: 'warning' };
  const label = o.status === 'ready' && o.fulfilment === 'pickup' ? 'Ready to collect' : ORDER_STATUS[o.status].vendorLabel;
  return { label, tone: ORDER_STATUS[o.status].tone };
};

export const RIDER_STEP: Record<string, string> = {
  assigned: 'Rider assigned',
  accepted_by_rider: 'Rider heading to the kitchen',
  arrived_at_branch: 'Rider at the kitchen',
  picked_up: 'Rider on the way to you',
  arrived_at_customer: 'Rider at your door',
  delivered: 'Delivered',
  declined: 'Finding another rider',
};

/** The same steps as the kitchen says them. */
export const RIDER_STEP_FOR_VENDOR: Record<string, string> = {
  assigned: 'Given to the rider, not accepted yet',
  accepted_by_rider: 'Rider heading to you',
  arrived_at_branch: 'Rider at your kitchen',
  picked_up: 'On the way to the customer',
  arrived_at_customer: 'At the customer',
  delivered: 'Delivered',
  declined: 'Handed back',
  unassigned: 'Taken back from the rider',
};

/** And as the rider says them. */
export const RIDER_STEP_FOR_RIDER: Record<string, string> = {
  assigned: 'New delivery',
  accepted_by_rider: 'Heading to the kitchen',
  arrived_at_branch: 'At the kitchen',
  picked_up: 'On the way to the customer',
  arrived_at_customer: 'At the customer',
  delivered: 'Delivered',
  declined: 'Handed back',
};

export const riderStepLabel = (s: RiderStep, audience: 'customer' | 'vendor' | 'rider' = 'customer') =>
  (audience === 'vendor' ? RIDER_STEP_FOR_VENDOR : audience === 'rider' ? RIDER_STEP_FOR_RIDER : RIDER_STEP)[s] ?? (audience === 'rider' ? 'New delivery' : 'Rider assigned');

/** The ONE pill on a rider's delivery: ready at the kitchen, new, on the way, done. */
export const riderDeliveryHeadline = (o: { status: FoodOrderStatus; riderStep: RiderStep | null }): FoodHeadline => {
  const step = o.riderStep ?? 'assigned';
  if (o.status === 'ready' && (step === 'assigned' || step === 'accepted_by_rider' || step === 'arrived_at_branch')) {
    return { label: 'Ready to collect', tone: 'info' };
  }
  const label = riderStepLabel(step, 'rider');
  if (step === 'assigned') return { label, tone: 'warning' };
  if (step === 'picked_up' || step === 'arrived_at_customer') return { label, tone: 'accent' };
  if (step === 'delivered') return { label, tone: 'success' };
  if (step === 'declined') return { label, tone: 'neutral' };
  return { label, tone: 'info' };
};

/** How the kitchen's app says where its own rider is with an order. */
export const VENDOR_RIDER_LINE = {
  withRider: 'With your rider',
  riderComing: 'Rider on the way',
  locationLive: 'Location live',
  locationOff: 'No live location',
  handedExternal: 'With your own rider, outside the app',
} as const;

/** What the kitchen sends and takes, said once. */
export const VENDOR_ORDER_LINE = {
  cutlery: 'Send cutlery',
  collectCash: (amount: string) => `Collect ${amount} at the door`,
  collectCounter: (amount: string) => `Collect ${amount} at the counter`,
} as const;

/** What a rider's next tap is called, by the step it moves to. */
export const RIDER_ACTION: Record<string, string> = {
  accepted_by_rider: 'Accept delivery',
  arrived_at_branch: 'I’m at the kitchen',
  picked_up: 'Picked up the order',
  arrived_at_customer: 'I’m at the customer',
  delivered: 'Delivered',
  declined: 'Decline',
};

// ─── The vendor's board ───────────────────────────────
export type BoardColumn = 'new' | 'cooking' | 'ready' | 'out';

export const BOARD_COLUMNS: { key: BoardColumn; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'cooking', label: 'Cooking' },
  { key: 'ready', label: 'Ready' },
  { key: 'out', label: 'Out for delivery' },
];

export const columnOf = (s: FoodOrderStatus): BoardColumn | null =>
  s === 'placed' ? 'new' : s === 'accepted' || s === 'preparing' ? 'cooking' : s === 'ready' ? 'ready' : s === 'on_the_way' ? 'out' : null;

/** The ETA chips a vendor accepts with (minutes). */
export const ETA_CHOICES = [10, 15, 20, 30, 45, 60];

export const REJECT_REASONS: { key: string; label: string }[] = [
  { key: 'too_busy', label: 'Too busy right now' },
  { key: 'item_unavailable', label: 'An item has run out' },
  { key: 'closing_soon', label: 'Closing soon' },
  { key: 'out_of_area', label: 'Too far to deliver' },
];

export const rejectReasonLabel = (key: string | null) => REJECT_REASONS.find(r => r.key === key)?.label ?? key ?? '';

export const CUSTOMER_CANCEL_REASONS = ['Ordered by mistake', 'Changed my mind', 'Taking too long'];

/** The seconds left to answer a new order, never below zero. */
export const secondsLeft = (acceptBy: string | null, now: number) => (acceptBy ? Math.max(0, Math.round((Date.parse(acceptBy) - now) / 1000)) : null);

/** "4:05" for a countdown. */
export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** How long a customer has to send a transfer once the order is placed (the API's window). */
export const TRANSFER_WINDOW_MINUTES = 10;

/** Minutes a kitchen is asked first when it accepts (the chips start here). */
export const DEFAULT_PREP_MINUTES = 20;

// ─── The kitchen's next move ──────────────────────────
export type VendorMove = 'accept' | 'preparing' | 'ready' | 'assign' | 'handed-external' | 'picked-up' | 'delivered' | 'check-transfer';

export const VENDOR_MOVE_LABEL: Record<VendorMove, string> = {
  accept: 'Accept',
  preparing: 'Start cooking',
  ready: 'Ready',
  assign: 'Give to a rider',
  'handed-external': 'Handed to our rider',
  'picked-up': 'Collected',
  delivered: 'Delivered',
  'check-transfer': 'Check the transfer',
};

/** The one big button on a card; null when the kitchen is waiting on someone else. */
export const nextVendorMove = (c: {
  status: FoodOrderStatus;
  fulfilment: FoodFulfilment;
  payment: { method: FoodPaymentMethod; status: FoodPaymentStatus };
  riderId: string | null;
  handedToExternal?: boolean;
}): VendorMove | null => {
  switch (c.status) {
    case 'placed':
      return 'accept';
    case 'accepted':
      return c.payment.method === 'transfer' && c.payment.status === 'proof_submitted' ? 'check-transfer' : 'preparing';
    case 'preparing':
      return 'ready';
    case 'ready':
      return c.fulfilment === 'pickup' ? 'picked-up' : c.riderId ? null : 'assign';
    case 'on_the_way':
      return c.riderId ? null : 'delivered';
    default:
      return null;
  }
};

/** "Just now", "4 min ago", "1 h 5 min ago". */
export const agoLabel = (iso: string, now: number) => {
  const m = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''} ago`;
};

/** How many orders sit in each board column. */
export const columnCounts = (cards: { status: FoodOrderStatus }[]) => {
  const out: Record<BoardColumn, number> = { new: 0, cooking: 0, ready: 0, out: 0 };
  for (const c of cards) {
    const col = columnOf(c.status);
    if (col) out[col] += 1;
  }
  return out;
};

/** An order the kitchen just moved, as its board card (keeping what only the card knows). */
export const cardOfOrder = (
  o: {
    id: string;
    code: string;
    status: FoodOrderStatus;
    statusLabel: string;
    fulfilment: FoodFulfilment;
    scheduledFor: string | null;
    placedAt: string;
    acceptBy: string | null;
    eta: { promisedAt: string | null };
    totals: { total: number };
    payment: { method: FoodPaymentMethod; status: FoodPaymentStatus };
    items: { name: string; quantity: number }[];
    customer: { name: string };
    handedToExternal: boolean;
    packedPhotoUrl?: string | null;
    origin?: { kind: 'app' | 'link' | 'qr' | 'tiffin' | 'catering'; ref: string | null };
  },
  prev: { riderId: string | null } | undefined,
) => ({
  id: o.id,
  code: o.code,
  status: o.status,
  statusLabel: o.statusLabel,
  fulfilment: o.fulfilment,
  scheduledFor: o.scheduledFor,
  placedAt: o.placedAt,
  acceptBy: o.acceptBy,
  promisedAt: o.eta.promisedAt,
  total: o.totals.total,
  payment: { method: o.payment.method, status: o.payment.status },
  itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
  itemsSummary: o.items.map(i => `${i.quantity}× ${i.name}`).join(', '),
  customerName: o.customer.name,
  riderId: prev?.riderId ?? null,
  handedToExternal: o.handedToExternal,
  packedPhotoUrl: o.packedPhotoUrl ?? null,
  origin: o.origin ?? { kind: 'app' as const, ref: null },
});

/** Why a kitchen cancels an order it already accepted (said to the customer). */
export const VENDOR_CANCEL_REASONS = ['An ingredient ran out', 'The kitchen has to close early', 'The customer asked to cancel', 'No rider is free to deliver it'];

/** Why a transfer isn't confirmed (said to the customer, who has 10 more minutes). */
export const PAYMENT_REJECT_REASONS = ['Not in our account yet', 'The amount doesn’t match', 'We can’t find that reference'];

/** What each move on the kitchen's order page is called (by the status it moves to). */
export const VENDOR_STATUS_ACTION: Partial<Record<FoodOrderStatus, string>> = {
  accepted: 'Accept',
  rejected: 'Decline',
  preparing: 'Start cooking',
  ready: 'Ready',
  on_the_way: 'Handed to our rider',
  picked_up: 'Collected',
  delivered: 'Delivered',
  cancelled: 'Cancel order',
};

// ─── The rider's next step ────────────────────────────
const RIDER_FLOW = ['accepted_by_rider', 'arrived_at_branch', 'picked_up', 'arrived_at_customer', 'delivered'];

/** The one big button: the furthest-forward step the server allows next (null: waiting, e.g. for the kitchen). */
export const primaryRiderStep = (next: string[]): string | null => RIDER_FLOW.find(s => next.includes(s)) ?? null;

/** Picked up isn't offered until the kitchen marks the order ready. */
export const waitingForKitchen = (o: { status: FoodOrderStatus; riderStep: string | null; nextSteps: string[] }) =>
  (o.status === 'accepted' || o.status === 'preparing') && !o.nextSteps.includes('picked_up') && o.riderStep !== null && ['assigned', 'accepted_by_rider', 'arrived_at_branch'].includes(o.riderStep);

/** Why a rider hands a delivery back (said to the kitchen). */
export const RIDER_DECLINE_REASONS = ['I’m too far away', 'My vehicle has a problem', 'I already have too many deliveries', 'I’m going off duty'];
