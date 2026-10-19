// ═══════════════════════════════════════════════════════
// MetroMatrix — Forecasts in honest words
// ═══════════════════════════════════════════════════════
// "Expected tomorrow: 42 (35–49)", "Learning your patterns" until there
// are two weeks of orders, "Last 7 days: 86% accurate" and what that means.

import type { Forecast, ForecastAccuracy, ForecastItem, PrepSheet, ShoppingList, VoiceQtyLine } from '../../types/kitchen';
import type { TodayMenu } from '../../types/food';
import { addDays, formatDayShort } from '../../utils/healthTime';
import { formatQty, type StandardUnit } from '../../utils/units';
import { editableAmount } from './stockModel';

export const FORECAST_DAYS = 7;

/** The days a forecast can be read for, in calendar order: today, tomorrow and the six days after it. */
export const forecastDates = (today: string) => [today, ...Array.from({ length: FORECAST_DAYS }, (_, n) => addDays(today, n + 1))];

/** The day the forecast opens on: tomorrow (what to buy and prep for). */
export const defaultForecastDate = (today: string) => addDays(today, 1);

export const dayLabel = (date: string, today: string) => (date === today ? 'Today' : date === addDays(today, 1) ? 'Tomorrow' : formatDayShort(date));

/** What the kitchen plans to make: the cook's number if set, else the forecast's, plus fixed tiffin and catering demand. */
export const plannedOf = (i: Pick<ForecastItem, 'adjusted' | 'expected' | 'fixed'>) => (i.adjusted ?? i.expected) + i.fixed.tiffin + i.fixed.catering;

export const rangeLabel = (i: Pick<ForecastItem, 'low' | 'high'>) => (i.low === i.high ? `${i.low}` : `${i.low}–${i.high}`);

export const expectedLine = (i: ForecastItem) => `Expected ${i.expected} (${rangeLabel(i)})`;

export const LEARNING_TITLE = 'Learning your patterns';
export const LEARNING_BODY = 'With two weeks of orders the ranges narrow. Until then, adjust them to what you know.';

export const forecastHeadline = (f: Forecast, today: string) =>
  `${dayLabel(f.date, today)}: about ${f.orders.expected} orders (${f.orders.low}–${f.orders.high})`;

/** The accuracy badge, or null while it can't be measured. */
export const accuracyBadge = (a: ForecastAccuracy | null) => (a && a.accuracyPct !== null ? `Last ${a.days} days: ${a.accuracyPct}% accurate` : null);

export const ACCURACY_EXPLAINED = [
  'Each day, we compare what we expected for every dish with what actually sold.',
  'Accuracy is 100 minus the average miss, weighted by how much each dish sells: a miss of 2 on a dish that sells 40 counts less than on one that sells 5.',
  'It needs about three weeks of orders to measure.',
];

/** The cook's change from the forecast, if any: "+6 on the forecast". */
export const adjustmentLabel = (i: Pick<ForecastItem, 'adjusted' | 'expected'>) => {
  if (i.adjusted === null || i.adjusted === i.expected) return null;
  const d = i.adjusted - i.expected;
  return `${d > 0 ? '+' : '−'}${Math.abs(d)} on the forecast`;
};

/** 0–1 positions of low, expected and high on a bar whose end is `max`. */
export const barPositions = (i: Pick<ForecastItem, 'low' | 'expected' | 'high' | 'adjusted'>, max: number) => {
  const m = Math.max(1, max);
  const at = (n: number) => Math.max(0, Math.min(1, n / m));
  return { low: at(i.low), expected: at(i.expected), high: at(i.high), adjusted: i.adjusted === null ? null : at(i.adjusted) };
};

/** The longest bar on a day's list, so every bar shares one scale. */
export const barMax = (items: ForecastItem[]) => items.reduce((m, i) => Math.max(m, i.high, i.adjusted ?? 0, plannedOf(i)), 1);

/** The prep sheet as checklist groups: each line's amount, and the dishes it is for. */
export const prepGroups = (sheet: PrepSheet) =>
  sheet.groups.map(g => ({
    key: g.key,
    title: g.title,
    lines: g.lines.map(l => ({
      id: `${sheet.date}|${l.ingredientId}`,
      name: l.name,
      qtyLabel: formatQty(l.qty, l.baseUnit, { dozens: l.dozens }),
      sub: l.forItems.length ? `For ${l.forItems.join(', ')}` : null,
    })),
  }));

/** "18 Chicken Biryani, 12 Karahi and 4 more". */
export const dishesLine = (sheet: Pick<PrepSheet, 'dishes'>, shown = 3) => {
  const head = sheet.dishes.slice(0, shown).map(d => `${d.servings} ${d.name}`);
  const more = sheet.dishes.length - shown;
  return more > 0 ? `${head.join(', ')} and ${more} more` : head.join(', ');
};

/** What is left to buy, as purchase lines to check (in the unit a cook buys it in). */
export const purchaseDraftOf = (list: ShoppingList): VoiceQtyLine[] =>
  list.lines
    .filter(l => l.toBuy > 0)
    .map(l => {
      const e = editableAmount(l, l.toBuy);
      return { ingredientId: l.ingredientId, key: null, name: l.name, qty: Number(e.amount), unit: e.unitKey as StandardUnit, total: l.estCost || null };
    });

/** Today's dishes whose planned number differs from their portions (cooking or not): what Today offers to apply. */
export const suggestedPortions = (today: TodayMenu, f: Forecast) =>
  f.items
    .map(i => ({ i, row: today.items.find(r => r.itemId === i.itemId && r.onTodaysMenu) }))
    .filter(x => !!x.row && plannedOf(x.i) > 0 && (x.row.dailyLimit !== plannedOf(x.i) || !x.row.cooking))
    .map(x => ({ itemId: x.i.itemId, name: x.i.name, portions: plannedOf(x.i), current: x.row!.dailyLimit }));

/** "Aloo Gosht 14, Daal Chawal 10 and 2 more". */
export const portionsLine = (rows: { name: string; portions: number }[], shown = 3) => {
  const head = rows.slice(0, shown).map(r => `${r.name} ${r.portions}`);
  return rows.length > shown ? `${head.join(', ')} and ${rows.length - shown} more` : head.join(', ');
};

/** "Need 2 kg · have 1.5 kg"; below zero in the records means a count is due, not a negative amount. */
export const needHaveLabel = (l: Pick<ShoppingList['lines'][number], 'need' | 'onHand' | 'baseUnit' | 'dozens'>) =>
  `Need ${formatQty(l.need, l.baseUnit, { dozens: l.dozens })} · ${l.onHand < 0 ? 'below zero in stock: count it' : `have ${formatQty(l.onHand, l.baseUnit, { dozens: l.dozens })}`}`;
