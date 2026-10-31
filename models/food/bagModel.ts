// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: the bag and checkout, as rules
// ═══════════════════════════════════════════════════════
// What a bag line says, which of the server's issues stop checkout (and
// what fixes each one), the times a customer can schedule for, how each way
// to pay reads, and the checkout form's own checks. Prices and totals are
// never worked out here: they are always the server's.

import type { FoodCart, FoodCartLine, FoodFulfilment, FoodIssue, FoodPaymentMethod, FoodPreview, FoodSlots } from '../food';
import type { ItemSheet } from '../food';
import { chosenOptionIds, type Selection } from './itemSelectionModel';
import { PAYMENT_METHOD } from './foodStatusModel';
import { formatDayShort, formatSlot, dateInZone } from '../../utils/health-time/healthTime';

/** The request "Add to bag" sends for the sheet's choice. */
export const lineInput = (vendorId: string, sheet: ItemSheet, sel: Selection) => ({
  vendorId,
  itemId: sheet.id,
  variantId: sheet.variants.length ? sel.variantId : null,
  optionIds: chosenOptionIds(sheet, sel),
  quantity: sel.quantity,
  notes: sel.note.trim() || null,
});

/** "Single · Mild, Raita" */
export const lineChoices = (l: Pick<FoodCartLine, 'variant' | 'options'>) => [l.variant?.name, l.options.map(o => o.name).join(', ')].filter(Boolean).join(' · ');

/** The bag's own problems: the address, the way to pay and a code come at checkout. */
const CHECKOUT_ONLY = ['ADDRESS_LOCATION_REQUIRED', 'NOT_FOUND', 'PAYMENT_METHOD_UNAVAILABLE', 'COD_LIMIT_EXCEEDED', 'PROMO_INVALID', 'PROMO_EXPIRED', 'PROMO_LIMIT_REACHED', 'OUT_OF_ZONE'];

/** The first thing in the bag that stops checkout (null: go ahead). */
export const bagBlocker = (cart: Pick<FoodCart, 'issues'>): FoodIssue | null => cart.issues.find(i => !CHECKOUT_ONLY.includes(i.code)) ?? null;

/** Issues that belong to one line are said on that line, not above the bag. */
export const bagNotices = (cart: Pick<FoodCart, 'warnings'>): FoodIssue[] => {
  const seen = new Set<string>();
  return cart.warnings.filter(w => {
    if (w.details && typeof w.details.lineId === 'string') return false;
    if (w.code === 'BELOW_MIN_ORDER') return false;
    const k = `${w.code}:${w.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/** What a blocking issue asks the customer to do. */
export type IssueFix = 'schedule' | 'pickup' | 'bag' | 'menu' | 'address' | 'payment' | 'code' | null;

export const fixOf = (i: FoodIssue): IssueFix => {
  switch (i.code) {
    case 'VENDOR_CLOSED':
    case 'SLOT_INVALID':
    case 'SLOT_FULL':
      return 'schedule';
    case 'OUT_OF_ZONE':
      return i.details?.pickupAvailable === false ? 'address' : 'pickup';
    case 'FULFILMENT_UNAVAILABLE':
      return 'pickup';
    case 'ITEM_UNAVAILABLE':
    case 'PORTIONS_SOLD_OUT':
    case 'OPTION_REQUIRED':
    case 'OPTION_INVALID':
    case 'OPTION_LIMIT':
    case 'CART_EMPTY':
      return 'bag';
    case 'BELOW_MIN_ORDER':
      return 'menu';
    case 'ADDRESS_LOCATION_REQUIRED':
    case 'NOT_FOUND':
      return 'address';
    case 'PAYMENT_METHOD_UNAVAILABLE':
    case 'COD_LIMIT_EXCEEDED':
      return 'payment';
    case 'PROMO_INVALID':
    case 'PROMO_EXPIRED':
    case 'PROMO_LIMIT_REACHED':
      return 'code';
    default:
      return null;
  }
};

export const FULFILMENT_LABEL: Record<FoodFulfilment, string> = { delivery: 'Delivery', pickup: 'Pick-up' };

// ─── When ─────────────────────────────────────────────
export interface WhenChoice {
  at: string;
  label: string;
  note: string | null;
  disabled: boolean;
}

/** A scheduled order is at least 30 minutes away (the vendor's prep time, if longer), at most a week. */
export const LEAD_MINUTES = 30;
const STEP_MINUTES = 30;
const MINUTE = 60_000;

/** "Today · 7:30 PM", "Tomorrow · 1:00 PM", "Sat 17 Oct · 8:00 PM". */
export const whenLabel = (iso: string, timezone: string, now: number) => {
  const day = dateInZone(iso, timezone);
  const today = dateInZone(new Date(now).toISOString(), timezone);
  const tomorrow = dateInZone(new Date(now + 86_400_000).toISOString(), timezone);
  const d = day === today ? 'Today' : day === tomorrow ? 'Tomorrow' : formatDayShort(day);
  return `${d} · ${formatSlot(iso, timezone)}`;
};

/**
 * The times to offer: a home kitchen's own slots (full ones shown, not
 * chosen), or every half hour from the lead time — or from when a closed
 * kitchen opens — for the next day. The server says if the kitchen is
 * closed at a time chosen.
 */
export const whenChoices = (slots: FoodSlots | null, now: number, opensAt: string | null = null, timezone = 'Asia/Karachi', leadMinutes = LEAD_MINUTES, hours = 24): WhenChoice[] => {
  if (slots?.usesSlots)
    return slots.slots.map(s => ({
      at: s.startsAt,
      label: whenLabel(s.startsAt, slots.timezone, now),
      note: s.full ? 'Full' : s.remaining <= 3 ? `${s.remaining} left` : null,
      disabled: s.full,
    }));
  const opens = opensAt ? Date.parse(opensAt) : NaN;
  const earliest = Math.max(now + Math.max(LEAD_MINUTES, leadMinutes) * MINUTE, Number.isNaN(opens) ? 0 : opens);
  const first = Math.ceil(earliest / (STEP_MINUTES * MINUTE)) * STEP_MINUTES * MINUTE;
  const out: WhenChoice[] = [];
  for (let t = first; t <= first + hours * 60 * MINUTE; t += STEP_MINUTES * MINUTE) {
    const at = new Date(t).toISOString();
    out.push({ at, label: whenLabel(at, timezone, now), note: null, disabled: false });
  }
  return out;
};

// ─── Paying ───────────────────────────────────────────
export interface PayChoice {
  method: FoodPaymentMethod;
  label: string;
  hint: string;
  available: boolean;
}

const UNAVAILABLE: Record<FoodPaymentMethod, string> = {
  cod: 'Not for this order',
  transfer: 'This kitchen hasn’t added an account',
  pay_at_pickup: 'For pick-up orders',
  tiffin_plan: 'For tiffin plans',
};

/** The ways to pay this order, in the order a customer expects them. */
export const payChoices = (p: Pick<FoodPreview, 'fulfilment' | 'payment'>): PayChoice[] => {
  const order: FoodPaymentMethod[] = p.fulfilment === 'pickup' ? ['pay_at_pickup', 'transfer'] : ['cod', 'transfer'];
  return order.map(method => ({
    method,
    label: PAYMENT_METHOD[method].label,
    hint: p.payment.available[method] ? PAYMENT_METHOD[method].hint : UNAVAILABLE[method],
    available: p.payment.available[method],
  }));
};

/** The method to start with: what the customer chose if it still works, else the first that does. */
export const defaultPayment = (p: Pick<FoodPreview, 'fulfilment' | 'payment'>, chosen: FoodPaymentMethod | null): FoodPaymentMethod | null => {
  if (chosen && p.payment.available[chosen]) return chosen;
  return payChoices(p).find(c => c.available)?.method ?? null;
};

// ─── The checkout form ────────────────────────────────
export const MAX_KITCHEN_NOTE = 300;
export const MAX_RIDER_NOTE = 200;
export const MAX_BUILDING = 80;
export const MAX_FLOOR = 30;

export interface CheckoutForm {
  fulfilment: FoodFulfilment;
  addressId: string | null;
  addressPinned: boolean;
  paymentMethod: FoodPaymentMethod | null;
  promoCode: string;
}

export const validateCheckout = (f: CheckoutForm): Record<string, string> => {
  const e: Record<string, string> = {};
  if (f.fulfilment === 'delivery') {
    if (!f.addressId) e.address = 'Choose where to deliver.';
    else if (!f.addressPinned) e.address = 'Drop a pin on the map for this address so the rider can find you.';
  }
  if (!f.paymentMethod) e.paymentMethod = 'Choose how you’ll pay.';
  const code = f.promoCode.trim();
  if (code && !/^[A-Za-z0-9-]{1,20}$/.test(code)) e.promoCode = 'A code is letters, digits or dashes.';
  return e;
};

/** A promo code as it is sent: trimmed and upper-cased. */
export const cleanCode = (raw: string) => raw.replace(/\s+/g, '').toUpperCase().slice(0, 20);
