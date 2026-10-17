// ═══════════════════════════════════════════════════════
// MetroMatrix — Food order wording (the ONE map)
// ═══════════════════════════════════════════════════════
// How an order, its payment and its rider's step are said, to the customer,
// the vendor and the rider; the tracking steps; the vendor board's columns;
// accept-time and decline-reason choices. Calm: no red for an ordinary end.
// Money is always paid to the vendor directly; nothing implies a MetroMatrix
// cut or MetroMatrix riders.

import type { FoodFulfilment, FoodOrderStatus, FoodPaymentMethod, FoodPaymentStatus, RiderStep } from '../../types/food';

export type Tone = 'neutral' | 'info' | 'success' | 'warning';

export const ORDER_STATUS: Record<FoodOrderStatus, { label: string; vendorLabel: string; tone: Tone }> = {
  placed: { label: 'Waiting for the restaurant', vendorLabel: 'New', tone: 'warning' },
  accepted: { label: 'Accepted', vendorLabel: 'Accepted', tone: 'info' },
  preparing: { label: 'Being prepared', vendorLabel: 'Cooking', tone: 'info' },
  ready: { label: 'Ready', vendorLabel: 'Ready', tone: 'info' },
  on_the_way: { label: 'On the way', vendorLabel: 'Out for delivery', tone: 'info' },
  delivered: { label: 'Delivered', vendorLabel: 'Delivered', tone: 'success' },
  picked_up: { label: 'Collected', vendorLabel: 'Collected', tone: 'success' },
  rejected: { label: 'Declined by the restaurant', vendorLabel: 'Declined', tone: 'neutral' },
  auto_rejected: { label: 'Not accepted in time', vendorLabel: 'Missed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', vendorLabel: 'Cancelled', tone: 'neutral' },
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
};

export const PAYMENT_STATUS: Record<FoodPaymentStatus, { label: string; vendorLabel: string; tone: Tone }> = {
  cod_pending: { label: 'Cash on delivery', vendorLabel: 'Cash on delivery', tone: 'neutral' },
  unpaid: { label: 'Pay at pickup', vendorLabel: 'Pays at pickup', tone: 'neutral' },
  awaiting_transfer: { label: 'Waiting for your transfer', vendorLabel: 'Waiting for transfer', tone: 'warning' },
  proof_submitted: { label: 'Receipt sent, waiting for the kitchen', vendorLabel: 'Check the transfer', tone: 'warning' },
  paid: { label: 'Paid', vendorLabel: 'Paid', tone: 'success' },
  void: { label: 'Nothing to pay', vendorLabel: 'No payment', tone: 'neutral' },
  refund_due: { label: 'The kitchen owes you a refund', vendorLabel: 'Refund due', tone: 'warning' },
  refunded: { label: 'Refunded', vendorLabel: 'Refunded', tone: 'neutral' },
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

export const riderStepLabel = (s: RiderStep) => RIDER_STEP[s] ?? 'Rider assigned';

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
