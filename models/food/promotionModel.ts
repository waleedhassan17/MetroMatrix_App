// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: deals, as rules
// ═══════════════════════════════════════════════════════
// The four kinds of deal, the form and its checks (the API's), the label a
// card shows (worded as the API words it, so the preview is what customers
// see), and a deal's state. Every deal is the vendor's own: MetroMatrix
// funds none and takes nothing. One deal per order — the best for the
// customer; a coded deal applies only when the code is typed.

import type { FoodPromotion, PromotionInput, PromotionKind, PromotionState } from '../../types/food';
import { formatPKR } from '../../utils/money';
import { PKT, addDays, dateInZone, formatDayShort, zonedToIso } from '../../utils/healthTime';

export const PROMOTION_KINDS: { key: PromotionKind; label: string; hint: string }[] = [
  { key: 'percent_off_order', label: '% off the order', hint: 'A share off the dishes, with a cap if you like' },
  { key: 'percent_off_items', label: '% off some dishes', hint: 'Only the dishes you choose' },
  { key: 'flat_off', label: 'Rupees off', hint: 'A fixed amount off the order' },
  { key: 'free_delivery', label: 'Free delivery', hint: 'You cover your rider’s fee' },
];

export const PROMOTION_STATE: Record<PromotionState, { label: string; tone: 'neutral' | 'accent' | 'success' }> = {
  live: { label: 'Live', tone: 'success' },
  scheduled: { label: 'Starts later', tone: 'accent' },
  ended: { label: 'Ended', tone: 'neutral' },
  inactive: { label: 'Off', tone: 'neutral' },
};

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_CHOICES = [1, 2, 3, 4, 5, 6, 0].map(d => ({ day: d, label: DAY_SHORT[d] }));

/** "Every day", "Weekdays", "Fri, Sat". */
export const daysLine = (days: number[]) => {
  const set = [...new Set(days)].sort();
  if (set.length === 7) return 'Every day';
  if (set.join() === '1,2,3,4,5') return 'Weekdays';
  if (set.join() === '0,6') return 'Weekends';
  return WEEKDAY_CHOICES.filter(c => set.includes(c.day))
    .map(c => c.label)
    .join(', ');
};

/** The label cards and the vendor's page show — the API's wording. */
export const dealLabel = (p: Pick<FoodPromotion, 'kind' | 'value' | 'minOrder'>) => {
  const over = p.minOrder > 0 ? ` over ${formatPKR(p.minOrder)}` : '';
  switch (p.kind) {
    case 'percent_off_order':
      return `${p.value}% off${over}`;
    case 'percent_off_items':
      return `${p.value}% off selected items`;
    case 'flat_off':
      return `${formatPKR(p.value)} off${over}`;
    case 'free_delivery':
      return `Free delivery${over}`;
  }
};

/** When it runs, in a line: "Every day · 6:00 PM–11:00 PM · until 31 Dec". */
export const whenLine = (p: Pick<FoodPromotion, 'weekdays' | 'timeFrom' | 'timeTo' | 'endsAt'>) =>
  [daysLine(p.weekdays), p.timeFrom && p.timeTo ? `${p.timeFrom}–${p.timeTo}` : null, p.endsAt ? `until ${formatDayShort(dateInZone(new Date(Date.parse(p.endsAt) - 1).toISOString(), PKT))}` : null]
    .filter(Boolean)
    .join(' · ');

// ─── The form ─────────────────────────────────────────
export interface PromotionForm {
  title: string;
  kind: PromotionKind;
  value: string;
  itemIds: string[];
  minOrder: string;
  maxDiscount: string;
  withCode: boolean;
  code: string;
  weekdays: number[];
  withWindow: boolean;
  timeFrom: string;
  timeTo: string;
  /** The last day it runs (YYYY-MM-DD), or '' for no end. */
  endsOn: string;
  usageLimit: string;
  perUserLimit: string;
  firstOrderOnly: boolean;
}

export const emptyPromotionForm = (): PromotionForm => ({
  title: '',
  kind: 'percent_off_order',
  value: '10',
  itemIds: [],
  minOrder: '0',
  maxDiscount: '',
  withCode: false,
  code: '',
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  withWindow: false,
  timeFrom: '18:00',
  timeTo: '23:00',
  endsOn: '',
  usageLimit: '',
  perUserLimit: '',
  firstOrderOnly: false,
});

const n = (v: number | null) => (v === null ? '' : String(v));

export const promotionForm = (p: FoodPromotion): PromotionForm => ({
  title: p.title,
  kind: p.kind,
  value: String(p.value),
  itemIds: [...p.itemIds],
  minOrder: String(p.minOrder),
  maxDiscount: n(p.maxDiscount),
  withCode: !!p.code,
  code: p.code ?? '',
  weekdays: [...p.weekdays],
  withWindow: !!(p.timeFrom && p.timeTo),
  timeFrom: p.timeFrom ?? '18:00',
  timeTo: p.timeTo ?? '23:00',
  // Stored as the instant after the last day ends.
  endsOn: p.endsAt ? dateInZone(new Date(Date.parse(p.endsAt) - 1).toISOString(), PKT) : '',
  usageLimit: n(p.usageLimit),
  perUserLimit: n(p.perUserLimit),
  firstOrderOnly: p.firstOrderOnly,
});

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const CODE = /^[A-Za-z0-9-]{3,20}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const whole = (s: string) => /^\d+$/.test(s.trim());
const numOf = (s: string) => Number(s.trim());
const isPercent = (k: PromotionKind) => k === 'percent_off_order' || k === 'percent_off_items';

/** `{ field: message }`, empty when it can be saved (the API's rules). */
export const validatePromotion = (f: PromotionForm, today: string): Record<string, string> => {
  const e: Record<string, string> = {};
  const title = f.title.trim();
  if (title.length < 2) e.title = 'Give the deal a name customers will see.';
  else if (title.length > 80) e.title = 'Keep the name under 80 characters.';
  if (isPercent(f.kind)) {
    if (!whole(f.value) || numOf(f.value) < 1 || numOf(f.value) > 100) e.value = 'A percent deal is 1–100%.';
  } else if (f.kind === 'flat_off') {
    if (!whole(f.value) || numOf(f.value) < 1) e.value = 'Enter the rupees off.';
    else if (numOf(f.value) > 100000) e.value = 'That’s more than any order.';
  }
  if (f.kind === 'percent_off_items' && !f.itemIds.length) e.itemIds = 'Choose the dishes this deal applies to.';
  if (!whole(f.minOrder || '0')) e.minOrder = 'Enter rupees, or 0 for any order.';
  if (isPercent(f.kind) && f.maxDiscount.trim() && (!whole(f.maxDiscount) || numOf(f.maxDiscount) < 1)) e.maxDiscount = 'Enter the most it can take off, or leave it empty.';
  if (f.withCode && !CODE.test(f.code.trim())) e.code = 'A code is 3–20 letters, digits or dashes.';
  if (!f.weekdays.length) e.weekdays = 'Choose at least one day.';
  if (f.withWindow) {
    if (!HHMM.test(f.timeFrom) || !HHMM.test(f.timeTo)) e.timeTo = 'Use times like 18:00.';
    else if (f.timeFrom === f.timeTo) e.timeTo = 'The window can’t start and end together.';
  }
  if (f.endsOn) {
    if (!DATE.test(f.endsOn)) e.endsOn = 'Choose the last day it runs.';
    else if (f.endsOn < today) e.endsOn = 'The last day can’t be in the past.';
  }
  if (f.usageLimit.trim() && (!whole(f.usageLimit) || numOf(f.usageLimit) < 1)) e.usageLimit = 'Enter how many orders in all, or leave it empty.';
  if (f.perUserLimit.trim() && (!whole(f.perUserLimit) || numOf(f.perUserLimit) < 1)) e.perUserLimit = 'Enter how many per customer, or leave it empty.';
  return e;
};

const orNull = (s: string) => (s.trim() ? numOf(s) : null);

/** The request body, from a form that passed. */
export const promotionInput = (f: PromotionForm): PromotionInput => ({
  title: f.title.trim(),
  kind: f.kind,
  value: f.kind === 'free_delivery' ? 0 : numOf(f.value),
  itemIds: f.kind === 'percent_off_items' ? f.itemIds : [],
  minOrder: numOf(f.minOrder || '0'),
  maxDiscount: isPercent(f.kind) ? orNull(f.maxDiscount) : null,
  code: f.withCode ? f.code.trim().toUpperCase() : null,
  // To the end of the last day, in Pakistan.
  endsAt: f.endsOn ? zonedToIso(addDays(f.endsOn, 1), '00:00', PKT) : null,
  weekdays: [...f.weekdays].sort(),
  timeFrom: f.withWindow ? f.timeFrom : null,
  timeTo: f.withWindow ? f.timeTo : null,
  usageLimit: orNull(f.usageLimit),
  perUserLimit: orNull(f.perUserLimit),
  firstOrderOnly: f.firstOrderOnly,
});

/** What the card will say, from the form as it is now (0 while a number is half-typed). */
export const formLabel = (f: PromotionForm) =>
  dealLabel({ kind: f.kind, value: whole(f.value) ? numOf(f.value) : 0, minOrder: whole(f.minOrder || '0') ? numOf(f.minOrder || '0') : 0 });
