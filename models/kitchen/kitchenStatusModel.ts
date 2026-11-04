// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Intelligence wording (the ONE map)
// ═══════════════════════════════════════════════════════
// How stock, recipe cards, waste, Bachat Box boxes and reservations, and
// (from 5B) tiffins, catering, hygiene and experiments are said. Plain
// words a home cook reads in five seconds: "Running low", "Cost to make",
// "You keep" — never COGS, SKU or MAPE.
//
// Tones are Shopping's families (models/shopping/orderStatusModel), as Food's
// orders use them: waiting warning (to approve, a transfer due), in progress
// info (reserved, being made, quoted, running), done success, stopped danger
// (declined, cancelled, not collected), neutral for what simply ended. Stock
// and costs keep red for what is wrong now (below zero, over target).

import type {
  ExperimentStatus,
  ExperimentVerdict,
  HygieneStatus,
  Quadrant,
  RamadanState,
  BoxStatus,
  CateringMode,
  CateringStatus,
  EventType,
  Meal,
  QuoteState,
  TiffinDayState,
  TiffinPayMethod,
  TiffinStatus,
  IngredientCategory,
  InsightSeverity,
  MovementKind,
  PauseReason,
  RecipeStatus,
  ReservationStatus,
  StockState,
  WasteReason,
} from '../kitchen';
import type { FoodPaymentStatus } from '../food';

export type KitchenTone = 'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'danger';

export const STOCK_STATE: Record<StockState, { label: string; tone: KitchenTone }> = {
  ok: { label: 'In stock', tone: 'success' },
  low: { label: 'Running low', tone: 'warning' },
  out: { label: 'Out', tone: 'warning' },
  negative: { label: 'Below zero', tone: 'danger' },
};

export const STOCK_SEGMENTS: { key: 'all' | 'low' | 'expiring' | 'negative'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'low', label: 'Running low' },
  { key: 'expiring', label: 'Expiring' },
  { key: 'negative', label: 'Below zero' },
];

export const CATEGORY_LABEL: Record<IngredientCategory, string> = {
  meat: 'Meat and poultry',
  vegetable: 'Vegetables and fruit',
  dairy: 'Dairy and eggs',
  grain: 'Rice, flour and daal',
  spice: 'Spices',
  oil: 'Oil and ghee',
  bakery: 'Bread and buns',
  beverage: 'Drinks',
  packaging: 'Packaging',
  other: 'Other',
};

export const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL) as IngredientCategory[];

export const MOVEMENT_LABEL: Record<MovementKind, string> = {
  purchase: 'Bought',
  usage: 'Used in orders',
  waste: 'Wasted',
  count: 'Stock count',
  return: 'Back in stock',
};

export const RECIPE_STATUS: Record<RecipeStatus, { label: string; tone: KitchenTone }> = {
  complete: { label: 'Recipe card done', tone: 'success' },
  partial: { label: 'Some sizes missing', tone: 'warning' },
  missing: { label: 'No recipe card', tone: 'neutral' },
};

export const WASTE_REASON_LABEL: Record<WasteReason, string> = {
  expired: 'Expired',
  spoiled: 'Went bad',
  overcooked: 'Overcooked or burnt',
  returned: 'Sent back',
  leftover: 'Left over',
  other: 'Other',
};

export const WASTE_REASONS = Object.keys(WASTE_REASON_LABEL) as WasteReason[];

export const PAUSE_REASON_LABEL: Record<PauseReason, string> = {
  gas: 'Gas',
  electricity: 'Electricity',
  weather: 'Weather',
  staff: 'Staff',
  stock: 'Stock',
  other: 'Other',
};

export const PAUSE_REASONS = Object.keys(PAUSE_REASON_LABEL) as PauseReason[];

/** How long a pause lasts before it lifts by itself (minutes; null: until resumed). */
export const PAUSE_DURATIONS: { minutes: number | null; label: string }[] = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
  { minutes: null, label: 'Until I resume' },
];

export const SEVERITY_TONE: Record<InsightSeverity, KitchenTone> = {
  critical: 'danger',
  warning: 'warning',
  info: 'info',
};

// ── Bachat Box ──
export const BOX_STATUS: Record<BoxStatus, { label: string; customerLabel: string; tone: KitchenTone }> = {
  live: { label: 'Live', customerLabel: 'Available', tone: 'success' },
  sold_out: { label: 'All reserved', customerLabel: 'All reserved', tone: 'neutral' },
  ended: { label: 'Ended', customerLabel: 'Closed for today', tone: 'neutral' },
  cancelled: { label: 'Taken down', customerLabel: 'No longer available', tone: 'danger' },
};

export const RESERVATION_STATUS: Record<ReservationStatus, { label: string; vendorLabel: string; tone: KitchenTone }> = {
  reserved: { label: 'Reserved for you', vendorLabel: 'To collect', tone: 'info' },
  collected: { label: 'Collected', vendorLabel: 'Collected', tone: 'success' },
  no_show: { label: 'Not collected', vendorLabel: 'No-show', tone: 'danger' },
  cancelled: { label: 'Cancelled', vendorLabel: 'Cancelled', tone: 'danger' },
};

export const BOX_PAYMENT: Record<'pay_at_pickup' | 'transfer', { label: string; hint: string }> = {
  pay_at_pickup: { label: 'Pay at pickup', hint: 'Pay the kitchen in cash when you collect.' },
  transfer: { label: 'Bank or wallet transfer', hint: 'Send the money to the kitchen’s own account, then share the receipt.' },
};

/** A reservation's payment, said to the customer and the kitchen (the kitchen is paid directly). */
export const BOX_PAYMENT_STATUS: Partial<Record<FoodPaymentStatus, { label: string; vendorLabel: string; tone: KitchenTone }>> = {
  unpaid: { label: 'Pay at pickup', vendorLabel: 'Pays at pickup', tone: 'neutral' },
  awaiting_transfer: { label: 'Waiting for your transfer', vendorLabel: 'Waiting for transfer', tone: 'warning' },
  proof_submitted: { label: 'Receipt sent, waiting for the kitchen', vendorLabel: 'Check the transfer', tone: 'info' },
  paid: { label: 'Paid', vendorLabel: 'Paid', tone: 'success' },
  void: { label: 'Nothing to pay', vendorLabel: 'No payment', tone: 'neutral' },
  refund_due: { label: 'The kitchen sends your money back', vendorLabel: 'Send the money back', tone: 'warning' },
};

export const boxPaymentStatus = (s: FoodPaymentStatus) => BOX_PAYMENT_STATUS[s] ?? { label: 'Payment', vendorLabel: 'Payment', tone: 'neutral' as KitchenTone };

// ── Tiffin (5B) ──
export const MEAL_LABEL: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

export const WEEKDAY_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAY_LONG = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const TIFFIN_STATUS: Record<TiffinStatus, { label: string; vendorLabel: string; tone: KitchenTone }> = {
  pending: { label: 'Waiting for the kitchen', vendorLabel: 'To approve', tone: 'warning' },
  active: { label: 'Active', vendorLabel: 'Active', tone: 'success' },
  paused: { label: 'Paused', vendorLabel: 'Paused', tone: 'neutral' },
  declined: { label: 'Not accepted', vendorLabel: 'Declined', tone: 'danger' },
  ended: { label: 'Ended', vendorLabel: 'Ended', tone: 'neutral' },
  cancelled: { label: 'Cancelled', vendorLabel: 'Cancelled', tone: 'danger' },
};

export const TIFFIN_DAY: Record<TiffinDayState, { label: string; tone: KitchenTone }> = {
  before_start: { label: 'Before your start', tone: 'neutral' },
  off: { label: 'No delivery', tone: 'neutral' },
  pending: { label: 'Once approved', tone: 'neutral' },
  upcoming: { label: 'Coming', tone: 'info' },
  skipped: { label: 'Skipped', tone: 'neutral' },
  paused: { label: 'Paused', tone: 'neutral' },
  ordered: { label: 'Being made', tone: 'info' },
  delivered: { label: 'Delivered', tone: 'success' },
  missed: { label: 'Not received', tone: 'danger' },
  cancelled: { label: 'Didn’t go out', tone: 'danger' },
  ended: { label: 'Ended', tone: 'neutral' },
  none: { label: 'No delivery', tone: 'neutral' },
};

export const TIFFIN_PAY: Record<TiffinPayMethod, { label: string; hint: string }> = {
  transfer: { label: 'Bank or wallet transfer', hint: 'Each period, send it to the kitchen’s own account and share the receipt.' },
  cash: { label: 'Cash', hint: 'Pay the kitchen in cash with the first delivery of each period.' },
};

// ── Catering (5B) ──
export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  dawat: 'Dawat at home',
  wedding: 'Wedding (mehndi, baraat, walima)',
  office: 'Office event',
  birthday: 'Birthday',
  milad: 'Milad or Quran khwani',
  other: 'Something else',
};

export const EVENT_TYPES = Object.keys(EVENT_TYPE_LABEL) as EventType[];

export const CATERING_MODE: Record<CateringMode, { label: string; hint: string }> = {
  delivery: { label: 'Delivered', hint: 'The kitchen brings it to the venue.' },
  pickup: { label: 'Collected', hint: 'You collect it from the kitchen.' },
  on_site: { label: 'Cooked on site', hint: 'The kitchen cooks and serves at the venue.' },
};

export const CATERING_STATUS: Record<CateringStatus, { label: string; vendorLabel: string; tone: KitchenTone }> = {
  requested: { label: 'Waiting for a quote', vendorLabel: 'New', tone: 'warning' },
  quoted: { label: 'Quote to look at', vendorLabel: 'Quoted', tone: 'info' },
  accepted: { label: 'Advance to pay', vendorLabel: 'Accepted, advance due', tone: 'warning' },
  advance_proof: { label: 'Receipt sent, waiting for the kitchen', vendorLabel: 'Check the advance', tone: 'info' },
  confirmed: { label: 'Confirmed', vendorLabel: 'Confirmed', tone: 'success' },
  declined: { label: 'The kitchen can’t take it', vendorLabel: 'Declined', tone: 'danger' },
  cancelled: { label: 'Cancelled', vendorLabel: 'Cancelled', tone: 'danger' },
  expired: { label: 'The quote ran out', vendorLabel: 'Quote ran out', tone: 'neutral' },
  completed: { label: 'Done', vendorLabel: 'Done', tone: 'success' },
};

export const QUOTE_STATE: Record<QuoteState, { label: string; tone: KitchenTone }> = {
  current: { label: 'Latest', tone: 'info' },
  outdated: { label: 'Replaced by a newer quote', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'neutral' },
  accepted: { label: 'Accepted', tone: 'success' },
};

/** A tiffin period's payment, to the customer and the kitchen (paid to the kitchen directly). */
export const TIFFIN_PERIOD_PAYMENT: Partial<Record<FoodPaymentStatus, { label: string; vendorLabel: string; tone: KitchenTone }>> = {
  unpaid: { label: 'Cash with the first delivery', vendorLabel: 'Cash to collect', tone: 'neutral' },
  awaiting_transfer: { label: 'Transfer due', vendorLabel: 'Waiting for transfer', tone: 'warning' },
  proof_submitted: { label: 'Receipt sent, waiting for the kitchen', vendorLabel: 'Check the transfer', tone: 'info' },
  paid: { label: 'Paid', vendorLabel: 'Paid', tone: 'success' },
  void: { label: 'Nothing to pay', vendorLabel: 'Nothing to pay', tone: 'neutral' },
};

export const tiffinPaymentStatus = (s: FoodPaymentStatus) => TIFFIN_PERIOD_PAYMENT[s] ?? { label: 'Payment', vendorLabel: 'Payment', tone: 'neutral' as KitchenTone };

// ── Reaching customers (5B) ──
export const RAMADAN_STATE: Record<RamadanState, { label: string; tone: KitchenTone }> = {
  active: { label: 'Ramadan now', tone: 'info' },
  upcoming: { label: 'Coming up', tone: 'neutral' },
  none: { label: 'Not now', tone: 'neutral' },
};

/** Menu insights' four groups, in plain words (never "plowhorse" or "dog"). */
export const QUADRANT: Record<Quadrant, { label: string; hint: string; tone: KitchenTone }> = {
  star: { label: 'Sells well, you keep a lot', hint: 'Many order it, and you keep a good share of each.', tone: 'success' },
  plowhorse: { label: 'Sells well, you keep little', hint: 'Many order it, but you keep little on each.', tone: 'warning' },
  puzzle: { label: 'You keep a lot, sells little', hint: 'You keep a lot on each, but few order it.', tone: 'info' },
  dog: { label: 'Sells little, you keep little', hint: 'Few order it, and you keep little on each.', tone: 'neutral' },
  unknown: { label: 'No recipe card', hint: 'Add its recipe card to see what you keep.', tone: 'neutral' },
};

export const QUADRANT_ORDER: Quadrant[] = ['star', 'plowhorse', 'puzzle', 'dog', 'unknown'];

export const EXPERIMENT_STATUS: Record<ExperimentStatus, { label: string; tone: KitchenTone }> = {
  running: { label: 'Running', tone: 'info' },
  done: { label: 'Result ready', tone: 'warning' },
  kept: { label: 'Kept', tone: 'success' },
  adjusted: { label: 'Adjusted', tone: 'success' },
  dropped: { label: 'Went back', tone: 'neutral' },
  stopped: { label: 'Stopped early', tone: 'neutral' },
};

export const VERDICT: Record<ExperimentVerdict, { label: string; hint: string; tone: KitchenTone }> = {
  keep: { label: 'Keep it', hint: 'Sales held up or grew with the change.', tone: 'success' },
  adjust: { label: 'Adjust it', hint: 'About the same as before. Try a smaller change.', tone: 'warning' },
  drop: { label: 'Go back', hint: 'Fewer orders than before. The old one did better.', tone: 'neutral' },
};

export const HYGIENE_STATUS: Record<HygieneStatus, { label: string; vendorLabel: string; tone: KitchenTone }> = {
  none: { label: 'Not declared', vendorLabel: 'Tick the checklist', tone: 'neutral' },
  self_declared: { label: 'Hygiene self-declared', vendorLabel: 'Self-declared', tone: 'neutral' },
  pending: { label: 'Hygiene self-declared', vendorLabel: 'Verification requested', tone: 'warning' },
  verified: { label: 'Hygiene verified', vendorLabel: 'Verified by MetroMatrix', tone: 'success' },
  rejected: { label: 'Hygiene self-declared', vendorLabel: 'Needs another look', tone: 'warning' },
};

// ── ONE pill per row ──
export interface KitchenHeadline {
  label: string;
  tone: KitchenTone;
}

/** A Bachat Box reservation's one pill: a transfer to send or being checked beats "Reserved". */
export const reservationHeadline = (r: { status: ReservationStatus; payment: { status: FoodPaymentStatus } }, audience: 'customer' | 'vendor' = 'customer'): KitchenHeadline => {
  const pick = (m: { label: string; vendorLabel: string; tone: KitchenTone }) => ({ label: audience === 'vendor' ? m.vendorLabel : m.label, tone: m.tone });
  if (r.status === 'reserved' && (r.payment.status === 'awaiting_transfer' || r.payment.status === 'proof_submitted')) return pick(boxPaymentStatus(r.payment.status));
  if (r.payment.status === 'refund_due') return pick(boxPaymentStatus('refund_due'));
  return pick(RESERVATION_STATUS[r.status]);
};

/** A tiffin's one pill: the period's transfer when it needs someone, else the subscription's state. */
export const tiffinHeadline = (t: { status: TiffinStatus; period: { payment: { status: FoodPaymentStatus } } | null }, audience: 'customer' | 'vendor' = 'customer'): KitchenHeadline => {
  const pick = (m: { label: string; vendorLabel: string; tone: KitchenTone }) => ({ label: audience === 'vendor' ? m.vendorLabel : m.label, tone: m.tone });
  const pay = t.period?.payment.status;
  if (t.status === 'active' && (pay === 'awaiting_transfer' || pay === 'proof_submitted')) return pick(tiffinPaymentStatus(pay));
  return pick(TIFFIN_STATUS[t.status]);
};
