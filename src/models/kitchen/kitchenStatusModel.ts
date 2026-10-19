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
