// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Intelligence wording (the ONE map)
// ═══════════════════════════════════════════════════════
// How stock, recipe cards, waste, Bachat Box boxes and reservations, and
// (from 5B) tiffins, catering, hygiene and experiments are said. Plain
// words a home cook reads in five seconds: "Running low", "Cost to make",
// "You keep" — never COGS, SKU or MAPE. Calm: red only where something is
// wrong now (stock below zero, food cost over target).

import type {
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
} from '../../types/kitchen';
import type { FoodPaymentStatus } from '../../types/food';

export type KitchenTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

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
  meat_poultry: 'Meat and poultry',
  vegetables: 'Vegetables',
  fruit: 'Fruit',
  dairy: 'Dairy and eggs',
  grains_flour: 'Rice, flour and daal',
  spices: 'Spices',
  oils_ghee: 'Oil and ghee',
  bakery: 'Bread and buns',
  drinks: 'Drinks',
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
  burnt: 'Burnt',
  dropped: 'Dropped or spilled',
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
  info: 'accent',
};

// ── Bachat Box ──
export const BOX_STATUS: Record<BoxStatus, { label: string; customerLabel: string; tone: KitchenTone }> = {
  live: { label: 'Live', customerLabel: 'Available', tone: 'success' },
  sold_out: { label: 'All reserved', customerLabel: 'All reserved', tone: 'neutral' },
  ended: { label: 'Ended', customerLabel: 'Closed for today', tone: 'neutral' },
  cancelled: { label: 'Taken down', customerLabel: 'No longer available', tone: 'neutral' },
};

export const RESERVATION_STATUS: Record<ReservationStatus, { label: string; vendorLabel: string; tone: KitchenTone }> = {
  reserved: { label: 'Reserved for you', vendorLabel: 'To collect', tone: 'accent' },
  collected: { label: 'Collected', vendorLabel: 'Collected', tone: 'success' },
  no_show: { label: 'Not collected', vendorLabel: 'No-show', tone: 'neutral' },
  cancelled: { label: 'Cancelled', vendorLabel: 'Cancelled', tone: 'neutral' },
};

export const BOX_PAYMENT: Record<'pay_at_pickup' | 'transfer', { label: string; hint: string }> = {
  pay_at_pickup: { label: 'Pay at pickup', hint: 'Pay the kitchen in cash when you collect.' },
  transfer: { label: 'Bank or wallet transfer', hint: 'Send the money to the kitchen’s own account, then share the receipt.' },
};

/** A reservation's payment, said to the customer and the kitchen (the kitchen is paid directly). */
export const BOX_PAYMENT_STATUS: Partial<Record<FoodPaymentStatus, { label: string; vendorLabel: string; tone: KitchenTone }>> = {
  unpaid: { label: 'Pay at pickup', vendorLabel: 'Pays at pickup', tone: 'neutral' },
  awaiting_transfer: { label: 'Waiting for your transfer', vendorLabel: 'Waiting for transfer', tone: 'warning' },
  proof_submitted: { label: 'Receipt sent, waiting for the kitchen', vendorLabel: 'Check the transfer', tone: 'warning' },
  paid: { label: 'Paid', vendorLabel: 'Paid', tone: 'success' },
  void: { label: 'Nothing to pay', vendorLabel: 'No payment', tone: 'neutral' },
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
  declined: { label: 'Not accepted', vendorLabel: 'Declined', tone: 'neutral' },
  ended: { label: 'Ended', vendorLabel: 'Ended', tone: 'neutral' },
  cancelled: { label: 'Cancelled', vendorLabel: 'Cancelled', tone: 'neutral' },
};

export const TIFFIN_DAY: Record<TiffinDayState, { label: string; tone: KitchenTone }> = {
  before_start: { label: 'Before your start', tone: 'neutral' },
  off: { label: 'No delivery', tone: 'neutral' },
  pending: { label: 'Once approved', tone: 'neutral' },
  upcoming: { label: 'Coming', tone: 'accent' },
  skipped: { label: 'Skipped', tone: 'neutral' },
  paused: { label: 'Paused', tone: 'neutral' },
  ordered: { label: 'Being made', tone: 'accent' },
  delivered: { label: 'Delivered', tone: 'success' },
  cancelled: { label: 'Didn’t go out', tone: 'warning' },
  ended: { label: 'Ended', tone: 'neutral' },
  none: { label: 'No delivery', tone: 'neutral' },
};

export const TIFFIN_PAY: Record<TiffinPayMethod, { label: string; hint: string }> = {
  transfer: { label: 'Bank or wallet transfer', hint: 'Each period, send it to the kitchen’s own account and share the receipt.' },
  cash: { label: 'Cash', hint: 'Pay the kitchen in cash with the first delivery of each period.' },
};

// ── Catering (5B) ──
export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  mehndi: 'Mehndi',
  baraat: 'Baraat',
  walima: 'Walima',
  birthday: 'Birthday',
  aqiqah: 'Aqiqah',
  milad: 'Milad',
  quran_khwani: 'Quran khwani',
  office: 'Office event',
  family: 'Family dinner',
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
  quoted: { label: 'Quote to look at', vendorLabel: 'Quoted', tone: 'accent' },
  accepted: { label: 'Advance to pay', vendorLabel: 'Accepted, advance due', tone: 'warning' },
  confirmed: { label: 'Confirmed', vendorLabel: 'Confirmed', tone: 'success' },
  declined: { label: 'The kitchen can’t take it', vendorLabel: 'Declined', tone: 'neutral' },
  cancelled: { label: 'Cancelled', vendorLabel: 'Cancelled', tone: 'neutral' },
  completed: { label: 'Done', vendorLabel: 'Done', tone: 'neutral' },
};

export const QUOTE_STATE: Record<QuoteState, { label: string; tone: KitchenTone }> = {
  current: { label: 'Latest', tone: 'accent' },
  outdated: { label: 'Replaced by a newer quote', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'neutral' },
  accepted: { label: 'Accepted', tone: 'success' },
};

/** A tiffin period's payment, to the customer and the kitchen (paid to the kitchen directly). */
export const TIFFIN_PERIOD_PAYMENT: Partial<Record<FoodPaymentStatus, { label: string; vendorLabel: string; tone: KitchenTone }>> = {
  unpaid: { label: 'Cash with the first delivery', vendorLabel: 'Cash to collect', tone: 'neutral' },
  awaiting_transfer: { label: 'Transfer due', vendorLabel: 'Waiting for transfer', tone: 'warning' },
  proof_submitted: { label: 'Receipt sent, waiting for the kitchen', vendorLabel: 'Check the transfer', tone: 'warning' },
  paid: { label: 'Paid', vendorLabel: 'Paid', tone: 'success' },
  void: { label: 'Nothing to pay', vendorLabel: 'Nothing to pay', tone: 'neutral' },
};

export const tiffinPaymentStatus = (s: FoodPaymentStatus) => TIFFIN_PERIOD_PAYMENT[s] ?? { label: 'Payment', vendorLabel: 'Payment', tone: 'neutral' as KitchenTone };
