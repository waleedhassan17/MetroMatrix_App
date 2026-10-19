// ═══════════════════════════════════════════════════════
// MetroMatrix — Tiffin in plain words, and the plan form
// ═══════════════════════════════════════════════════════
// "Lunch · Mon to Fri", "Rs 2,300 a week (Rs 460 a meal)", "Changes for
// Fri close Thu, 10:30 PM", a month as weeks starting on Monday, and the
// kitchen's plan form checked against the API's limits (§3.9) before it is
// sent. Pure: the slices and screens call these.

import type { Meal, TiffinDay, TiffinPeriod, TiffinPlan, TiffinPlanCard, TiffinPlanInput, TiffinPeriodKind, TiffinMode } from '../../types/kitchen';
import type { TiffinPlanCardData } from '../../Custom-Components/kitchen/TiffinPlanCard';
import type { ValidationErrors } from '../authModel';
import { addDays, formatDayShort, formatWhen, isoWeekday } from '../../utils/healthTime';
import { formatPKR, parseRupees } from '../../utils/money';
import { MEAL_LABEL, WEEKDAY_LONG, WEEKDAY_SHORT } from './kitchenStatusModel';

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
export const MAX_PLAN_DISHES = 4;
export const CUTOFF_CHOICES = [4, 6, 10, 12, 14, 24];
export const MAX_START_DAYS = 30;

/** "Every day", "Mon to Fri", "Mon, Wed, Fri". */
export const daysLabel = (days: number[]) => {
  const d = [...days].sort((a, b) => a - b);
  if (d.length === 7) return 'Every day';
  if (d.length >= 3 && d.every((x, n) => n === 0 || x === d[n - 1] + 1)) return `${WEEKDAY_SHORT[d[0]]} to ${WEEKDAY_SHORT[d[d.length - 1]]}`;
  return d.map(x => WEEKDAY_SHORT[x]).join(', ');
};

export const scheduleLabel = (p: { meal: Meal; days: number[] }) => `${MEAL_LABEL[p.meal]} · ${daysLabel(p.days)}`;

/** "Rs 2,300 a week", "Rs 10,800 for 4 weeks". */
export const priceLabel = (p: { price: number; period: TiffinPeriodKind }) => (p.period === 'week' ? `${formatPKR(p.price)} a week` : `${formatPKR(p.price)} for 4 weeks`);

export const perMealLabel = (p: { perMeal: number }) => `${formatPKR(p.perMeal)} a meal`;

/** The card's words for a plan (the vendor page's short form, or the whole plan). */
export const planCardData = (p: TiffinPlan | TiffinPlanCard, vendorName?: string): TiffinPlanCardData => ({
  id: p.id,
  name: p.name,
  scheduleLabel: `${scheduleLabel(p)} · ${typeof p.window === 'string' ? p.window : p.window.label}`,
  priceLabel: `${priceLabel(p)} · ${perMealLabel(p)}`,
  rotation: 'rotation' in p ? p.rotation.slice(0, 3).map(r => `${WEEKDAY_SHORT[r.weekday]}: ${[...r.dishes.map(d => d.name), ...(r.note ? [r.note] : [])].join(', ')}`) : [],
  placesLeft: p.seatsLeft,
  vendorName: vendorName ?? ('vendor' in p ? p.vendor.name : null),
});

/** The days a subscription can start on: plan days from the earliest open one, two weeks of them. */
export const startChoices = (p: Pick<TiffinPlan, 'days' | 'nextStart'>, count = 10) => {
  if (!p.nextStart) return [];
  const out: string[] = [];
  for (let d = p.nextStart; out.length < count && d <= addDays(p.nextStart, MAX_START_DAYS); d = addDays(d, 1)) if (p.days.includes(isoWeekday(d))) out.push(d);
  return out;
};

/** "Changes close Thu 15 Oct, 10:30 PM". */
export const cutoffLabel = (cutoffAt: string | null, tz: string) => (cutoffAt ? `Changes close ${formatWhen(cutoffAt, tz)}` : '');

/** "16 Oct – 22 Oct". */
export const periodLabel = (x: Pick<TiffinPeriod, 'from' | 'to'>) => `${formatDayShort(x.from).replace(/^\w+ /, '')} – ${formatDayShort(x.to).replace(/^\w+ /, '')}`;

/** What the period costs, and why it is less: "Rs 1,840 (Rs 460 off for 1 skipped meal)". */
export const periodAmountLabel = (x: Pick<TiffinPeriod, 'amount' | 'credit'>, perMeal: number) =>
  x.credit ? `${formatPKR(x.amount)} (${formatPKR(x.credit * perMeal)} off for ${x.credit} skipped ${x.credit === 1 ? 'meal' : 'meals'})` : formatPKR(x.amount);

// ── The month ──
export const monthOf = (date: string) => date.slice(0, 7);

export const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`;
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthLabel = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/** The month as weeks from Monday; days outside it are null. */
export const monthGrid = (days: TiffinDay[]): (TiffinDay | null)[][] => {
  if (!days.length) return [];
  const lead = isoWeekday(days[0].date) - 1;
  const cells: (TiffinDay | null)[] = [...Array.from({ length: lead }, () => null), ...days];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
};

/** A calendar day in words, for a screen reader and the day sheet: "Monday 19 October: Daal chawal. Skipped." */
export const dayA11y = (d: TiffinDay, stateLabel: string) => `${WEEKDAY_LONG[isoWeekday(d.date)]} ${formatDayShort(d.date).replace(/^\w+ /, '')}${d.dishes.length ? `: ${d.dishes.join(', ')}` : ''}. ${stateLabel}.`;

// ── The kitchen's plan form ──
export interface TiffinPlanForm {
  name: string;
  description: string;
  meal: Meal;
  days: number[];
  period: TiffinPeriodKind;
  price: string;
  mode: TiffinMode;
  from: string;
  to: string;
  capacity: string;
  skipCutoffHours: number;
  /** weekday → the dishes (menu ids) and a note. */
  rotation: Record<number, { itemIds: string[]; note: string }>;
}

export const MEAL_WINDOWS: Record<Meal, { from: string; to: string }> = {
  breakfast: { from: '08:00', to: '09:30' },
  lunch: { from: '12:30', to: '13:30' },
  dinner: { from: '19:30', to: '20:30' },
};

export const emptyPlanForm = (): TiffinPlanForm => ({
  name: '',
  description: '',
  meal: 'lunch',
  days: [1, 2, 3, 4, 5],
  period: 'week',
  price: '',
  mode: 'delivery',
  ...MEAL_WINDOWS.lunch,
  capacity: '20',
  skipCutoffHours: 12,
  rotation: {},
});

export const formFromPlan = (p: TiffinPlan): TiffinPlanForm => ({
  name: p.name,
  description: p.description ?? '',
  meal: p.meal,
  days: p.days,
  period: p.period,
  price: String(p.price),
  mode: p.mode,
  from: p.window.from,
  to: p.window.to,
  capacity: String(p.capacity),
  skipCutoffHours: p.skipCutoffHours,
  rotation: Object.fromEntries(p.rotation.map(r => [r.weekday, { itemIds: r.dishes.map(d => d.itemId), note: r.note ?? '' }])),
});

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "12:30" from what a cook types ("12.30", "1230", "9:5" is not a time). */
export const normaliseTime = (raw: string) => {
  const m = raw.trim().replace('.', ':').match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return raw.trim();
  return `${m[1].padStart(2, '0')}:${m[2]}`;
};

export const validatePlan = (f: TiffinPlanForm): ValidationErrors => {
  const errors: ValidationErrors = {};
  const name = f.name.trim();
  if (name.length < 3 || name.length > 60) errors.name = 'Give the plan a short name';
  if (!f.days.length) errors.days = 'Pick the days it is delivered';
  const price = parseRupees(f.price);
  if (price === null || price < 100) errors.price = f.period === 'week' ? 'The price for a week' : 'The price for four weeks';
  const from = normaliseTime(f.from);
  const to = normaliseTime(f.to);
  if (!HHMM.test(from) || !HHMM.test(to) || to <= from) errors.window = 'A time window like 12:30 to 13:30';
  const capacity = Number(f.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) errors.capacity = '1 to 500 people';
  const missing = f.days.filter(d => !(f.rotation[d]?.itemIds.length || f.rotation[d]?.note.trim()));
  if (missing.length) errors.rotation = `Say what is cooked on ${missing.map(d => WEEKDAY_SHORT[d]).join(', ')}`;
  return errors;
};

export const planInput = (f: TiffinPlanForm): TiffinPlanInput => ({
  name: f.name.trim(),
  description: f.description.trim() || null,
  meal: f.meal,
  days: [...f.days].sort((a, b) => a - b),
  period: f.period,
  price: parseRupees(f.price) ?? 0,
  mode: f.mode,
  window: { from: normaliseTime(f.from), to: normaliseTime(f.to) },
  capacity: Number(f.capacity),
  skipCutoffHours: f.skipCutoffHours,
  rotation: [...f.days]
    .sort((a, b) => a - b)
    .map(weekday => ({ weekday, itemIds: (f.rotation[weekday]?.itemIds ?? []).slice(0, MAX_PLAN_DISHES), note: f.rotation[weekday]?.note.trim() || null })),
});

/** What a plan works out at per meal, while the form is typed. */
export const draftPerMeal = (f: Pick<TiffinPlanForm, 'price' | 'days' | 'period'>) => {
  const price = parseRupees(f.price);
  const meals = f.days.length * (f.period === 'week' ? 1 : 4);
  return price && meals ? Math.round(price / meals) : null;
};

export const cutoffChoiceLabel = (hours: number, from: string) => {
  const [h, m] = from.split(':').map(Number);
  if (!Number.isFinite(h)) return `${hours} hours before`;
  const total = h * 60 + (m || 0) - hours * 60;
  const day = total < 0 ? 'the day before' : 'that day';
  const mins = ((total % 1440) + 1440) % 1440;
  const hh = Math.floor(mins / 60);
  const label = `${((hh + 11) % 12) + 1}:${String(mins % 60).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
  return `${hours} hours before (${label}, ${day})`;
};
