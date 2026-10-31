// ═══════════════════════════════════════════════════════
// MetroMatrix — Catering ("Plan a dawat") in plain words, and its forms
// ═══════════════════════════════════════════════════════
// The customer's request form and the kitchen's quote builder, checked
// against the API's rules (§3.10) before they are sent; "Aqiqah · 60
// guests · Sat 31 Oct, 7:30 PM"; a quote as the QuoteCard shows it.

import type { CateringMode, CateringQuote, CateringRequest, CateringRequestInput, CateringVendor, EventType, QuoteInput } from '../../types/kitchen';
import type { QuoteCardData } from '../../Custom-Components/kitchen/QuoteCard';
import type { ValidationErrors } from '../authModel';
import { addDays, formatDayShort, formatWhen, zonedToIso } from '../../utils/healthTime';
import { formatPKR, parseRupees } from '../../utils/money';
import { EVENT_TYPE_LABEL, QUOTE_STATE } from './kitchenStatusModel';

export const MAX_GUESTS = 2000;
export const MAX_DISHES = 20;
export const ADVANCE_CHOICES = [0, 25, 30, 50];
export const VALID_DAY_CHOICES = [2, 5, 7];

let seq = 0;
export const newDishKey = () => `dish-${Date.now().toString(36)}-${++seq}`;

/** Times a dawat can start: every half hour from 11 AM to 11:30 PM. */
export const EVENT_TIMES = Array.from({ length: 26 }, (_, n) => {
  const mins = 11 * 60 + n * 30;
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
});

export const timeLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/** "Aqiqah · 60 guests · Sat 31 Oct, 7:30 PM". */
export const eventLine = (r: Pick<CateringRequest, 'eventType' | 'guests' | 'date' | 'time'>) =>
  `${EVENT_TYPE_LABEL[r.eventType]} · ${r.guests} guests · ${formatDayShort(r.date)}, ${timeLabel(r.time)}`;

/** "60 guests · Sat 31 Oct, 7:30 PM" (under a title that already names the event). */
export const whenLine = (r: Pick<CateringRequest, 'guests' | 'date' | 'time'>) => `${r.guests} guests · ${formatDayShort(r.date)}, ${timeLabel(r.time)}`;

export const latestQuote = (r: Pick<CateringRequest, 'quotes'>) => r.quotes[r.quotes.length - 1] ?? null;

export const quoteCardData = (q: CateringQuote, tz: string, latestVersion: number): QuoteCardData => ({
  version: q.version,
  lines: q.lines.map(l => ({ name: l.name, quantity: l.qty, unitPrice: l.unitPrice, total: l.total })),
  deliveryFee: q.deliveryFee,
  total: q.total,
  advancePct: q.advancePct,
  advance: q.advance,
  validUntilLabel: `Valid until ${formatWhen(q.validUntil, tz)}`,
  notes: q.notes,
  stateLabel: q.state === 'outdated' && latestVersion > q.version ? `Replaced by version ${latestVersion}` : QUOTE_STATE[q.state].label,
  current: q.state === 'current' || q.state === 'accepted',
});

// ── The customer's request ──
export interface CateringForm {
  date: string | null;
  time: string;
  guests: string;
  eventType: EventType;
  dishes: { key: string; itemId: string | null; name: string; qty: string }[];
  budget: string;
  mode: CateringMode;
  addressId: string | null;
  notes: string;
}

export const emptyCateringForm = (): CateringForm => ({ date: null, time: '19:30', guests: '', eventType: 'family', dishes: [], budget: '', mode: 'delivery', addressId: null, notes: '' });

/** The days to pick from: from the earliest the kitchen allows, eight weeks of them. */
export const eventDates = (v: Pick<CateringVendor, 'earliestDate'>, count = 56) => (v.earliestDate ? Array.from({ length: count }, (_, n) => addDays(v.earliestDate, n)) : []);

export const validateCatering = (f: CateringForm, v: Pick<CateringVendor, 'minGuests' | 'earliestDate'>): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!f.date || f.date < v.earliestDate) errors.date = 'Pick the day of the event';
  const guests = Number(f.guests);
  if (!Number.isInteger(guests) || guests < v.minGuests || guests > MAX_GUESTS) errors.guests = `${v.minGuests} to ${MAX_GUESTS} guests`;
  if (!f.dishes.length) errors.dishes = 'Add the dishes you want';
  else if (f.dishes.length > MAX_DISHES) errors.dishes = `Up to ${MAX_DISHES} dishes`;
  else if (f.dishes.some(d => !(Number(d.qty) >= 1) || !Number.isInteger(Number(d.qty)))) errors.dishes = 'Say how many of each dish';
  else if (f.dishes.some(d => !d.itemId && d.name.trim().length < 2)) errors.dishes = 'Name each dish';
  if (f.budget.trim() && (parseRupees(f.budget) ?? 0) < 1000) errors.budget = 'A budget in rupees, or leave it empty';
  if (f.mode !== 'pickup' && !f.addressId) errors.addressId = 'Choose where the event is';
  return errors;
};

export const cateringInput = (f: CateringForm, vendorId: string): CateringRequestInput => ({
  vendorId,
  date: f.date ?? '',
  time: f.time,
  guests: Number(f.guests),
  eventType: f.eventType,
  dishes: f.dishes.map(d => (d.itemId ? { itemId: d.itemId, qty: Number(d.qty) } : { name: d.name.trim(), qty: Number(d.qty) })),
  budget: f.budget.trim() ? parseRupees(f.budget) : null,
  mode: f.mode,
  addressId: f.mode === 'pickup' ? null : f.addressId,
  notes: f.notes.trim() || null,
});

// ── The kitchen's quote ──
export interface QuoteDraft {
  lines: { key: string; itemId: string | null; name: string; qty: string; unitPrice: string }[];
  deliveryFee: string;
  advancePct: number;
  validDays: number;
  notes: string;
}

/** The request's dishes at the menu's prices (or the last quote's lines, for a new version). */
export const draftFromRequest = (r: CateringRequest, prices: Record<string, number>): QuoteDraft => {
  const last = latestQuote(r);
  if (last)
    return {
      lines: last.lines.map(l => ({ key: newDishKey(), itemId: l.itemId, name: l.name, qty: String(l.qty), unitPrice: String(l.unitPrice) })),
      deliveryFee: String(last.deliveryFee),
      advancePct: last.advancePct,
      validDays: 5,
      notes: last.notes ?? '',
    };
  return {
    lines: r.dishes.map(d => ({ key: newDishKey(), itemId: d.itemId, name: d.name, qty: String(d.qty), unitPrice: d.itemId && prices[d.itemId] ? String(prices[d.itemId]) : '' })),
    deliveryFee: r.mode === 'pickup' ? '0' : '',
    advancePct: 30,
    validDays: 5,
    notes: '',
  };
};

const lineTotal = (l: QuoteDraft['lines'][number]) => (Number(l.qty) || 0) * (parseRupees(l.unitPrice) ?? 0);

export const quoteTotals = (d: QuoteDraft) => {
  const subtotal = d.lines.reduce((n, l) => n + lineTotal(l), 0);
  const total = subtotal + (parseRupees(d.deliveryFee) ?? 0);
  return { subtotal, total, advance: Math.round((total * d.advancePct) / 100), lineTotal };
};

export const validateQuote = (d: QuoteDraft): { errors: ValidationErrors; lineErrors: Record<string, string> } => {
  const errors: ValidationErrors = {};
  const lineErrors: Record<string, string> = {};
  if (!d.lines.length) errors.lines = 'Add at least one line';
  for (const l of d.lines) {
    if (l.name.trim().length < 2) lineErrors[l.key] = 'Name it';
    else if (!(Number(l.qty) >= 1) || !Number.isInteger(Number(l.qty))) lineErrors[l.key] = 'How many';
    else if (parseRupees(l.unitPrice) === null) lineErrors[l.key] = 'Price each';
  }
  if (d.deliveryFee.trim() && parseRupees(d.deliveryFee) === null) errors.deliveryFee = 'Whole rupees, or 0';
  return { errors, lineErrors };
};

/** Valid for `validDays`, but never past an hour before the event. */
export const quoteInput = (d: QuoteDraft, r: Pick<CateringRequest, 'startsAt'>, now: number): QuoteInput => {
  const until = Math.min(now + d.validDays * 86_400_000, Date.parse(r.startsAt) - 3_600_000);
  return {
    lines: d.lines.map(l => ({ ...(l.itemId ? { itemId: l.itemId } : null), name: l.name.trim(), qty: Number(l.qty), unitPrice: parseRupees(l.unitPrice) ?? 0 })),
    deliveryFee: parseRupees(d.deliveryFee) ?? 0,
    advancePct: d.advancePct,
    validUntil: new Date(until).toISOString(),
    notes: d.notes.trim() || null,
  };
};

/** "Rs 11,070 advance (30%), Rs 25,830 on the day". */
export const advanceLine = (q: Pick<CateringQuote, 'advance' | 'advancePct' | 'total'>) =>
  q.advance ? `${formatPKR(q.advance)} advance (${q.advancePct}%), ${formatPKR(q.total - q.advance)} on the day` : `${formatPKR(q.total)} on the day, no advance`;

/** The event's start in the kitchen's time (for the form's preview). */
export const eventStartsAt = (date: string, time: string, tz: string) => zonedToIso(date, time, tz);
