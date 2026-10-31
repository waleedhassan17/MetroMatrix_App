// ═══════════════════════════════════════════════════════
// MetroMatrix — Bachat Box: the kitchen's form and the customer's reserve
// ═══════════════════════════════════════════════════════
// A box is tonight's surplus at least 20% under what it is worth, picked
// up today in a window of at least 30 minutes. Mirrors the API's rules
// (docs/API_KITCHEN_ASSUMED.md §3.6) so the form says what's wrong first.

import type { SurplusBoxInput, SurplusSuggestion } from '../kitchen';
import type { ValidationErrors } from '../authModel';
import { parseRupees } from '../../utils/money/money';
import { addDays, formatSlot, todayInZone, zonedToIso } from '../../utils/health-time/healthTime';

export const MIN_DISCOUNT = 0.2;
export const MAX_BOX_QUANTITY = 50;
export const MIN_WINDOW_MINUTES = 30;
export const BACHAT_BOX = 'Bachat Box';

export interface BoxForm {
  title: string;
  contentsHint: string;
  value: string;
  price: string;
  quantity: number;
  /** ISO instants. */
  pickupFrom: string;
  pickupTo: string;
  photoUrl: string | null;
}

export const formFromSuggestion = (s: SurplusSuggestion): BoxForm => ({
  title: s.title,
  contentsHint: s.contentsHint,
  value: String(s.value),
  price: String(s.price),
  quantity: s.quantity,
  pickupFrom: s.pickupFrom,
  pickupTo: s.pickupTo,
  photoUrl: null,
});

export const emptyBoxForm = (now: number): BoxForm => {
  const from = Math.ceil((now + 30 * 60_000) / (15 * 60_000)) * 15 * 60_000;
  return { title: '', contentsHint: '', value: '', price: '', quantity: 3, pickupFrom: new Date(from).toISOString(), pickupTo: new Date(from + 2 * 3_600_000).toISOString(), photoUrl: null };
};

/** "62% off". */
export const discountLabel = (value: number, price: number) => (value > 0 ? `${Math.round((1 - price / value) * 100)}% off` : '');

export const validateBox = (f: BoxForm, now: number): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (f.title.trim().length < 3) errors.title = 'Give the box a short name';
  if (f.contentsHint.trim().length < 3) errors.contentsHint = 'Say roughly what is inside';
  const value = parseRupees(f.value);
  const price = parseRupees(f.price);
  if (value === null || value < 50) errors.value = 'What the food would usually cost';
  if (price === null || price < 50) errors.price = 'The Bachat Box price';
  else if (value !== null && price > Math.floor(value * (1 - MIN_DISCOUNT))) errors.price = `At least ${MIN_DISCOUNT * 100}% under its value`;
  if (!Number.isInteger(f.quantity) || f.quantity < 1 || f.quantity > MAX_BOX_QUANTITY) errors.quantity = `1 to ${MAX_BOX_QUANTITY} boxes`;
  const from = Date.parse(f.pickupFrom);
  const to = Date.parse(f.pickupTo);
  if (!(to - from >= MIN_WINDOW_MINUTES * 60_000)) errors.pickupTo = `Give at least ${MIN_WINDOW_MINUTES} minutes to collect`;
  else if (to <= now) errors.pickupTo = 'The window has to end later than now';
  return errors;
};

export const boxInput = (f: BoxForm): SurplusBoxInput => ({
  title: f.title.trim(),
  contentsHint: f.contentsHint.trim(),
  value: parseRupees(f.value) ?? 0,
  price: parseRupees(f.price) ?? 0,
  quantity: f.quantity,
  pickupFrom: f.pickupFrom,
  pickupTo: f.pickupTo,
  photoUrl: f.photoUrl,
});

/** A pickup code as the customer reads it out: "BB-7KQ2PX". */
export const normalizeCode = (raw: string) => {
  const c = raw.trim().toUpperCase().replace(/\s+/g, '');
  return c.startsWith('BB-') ? c : c.length === 6 ? `BB-${c}` : c;
};

export const isPickupCode = (raw: string) => /^BB-[A-Z2-9]{6}$/.test(normalizeCode(raw));

const QUARTER = 15 * 60_000;

/**
 * The times a pickup window can start or end: every 15 minutes from now
 * until 2 AM (Bachat Boxes are tonight's food; the API refuses later).
 */
export const pickupTimes = (now: number, timezone: string) => {
  const lastEnd = Date.parse(zonedToIso(addDays(todayInZone(timezone, now), 1), '02:00', timezone));
  const out: { iso: string; label: string }[] = [];
  for (let t = Math.ceil(now / QUARTER) * QUARTER; t <= lastEnd; t += QUARTER) {
    const iso = new Date(t).toISOString();
    out.push({ iso, label: formatSlot(iso, timezone) });
  }
  return out;
};

/** A new start keeps the window's length (two hours by default), never past 2 AM. */
export const withPickupFrom = (f: BoxForm, fromIso: string, timezone: string, now: number): BoxForm => {
  const length = Math.max(MIN_WINDOW_MINUTES * 60_000, Date.parse(f.pickupTo) - Date.parse(f.pickupFrom)) || 2 * 3_600_000;
  const times = pickupTimes(now, timezone);
  const last = times.length ? Date.parse(times[times.length - 1].iso) : Date.parse(fromIso) + length;
  return { ...f, pickupFrom: fromIso, pickupTo: new Date(Math.min(Date.parse(fromIso) + length, last)).toISOString() };
};
