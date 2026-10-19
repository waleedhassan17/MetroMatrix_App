// ═══════════════════════════════════════════════════════
// MetroMatrix — Forecasts in honest words
// ═══════════════════════════════════════════════════════
// "Expected tomorrow: 42 (35–49)", "Learning your patterns" until there
// are two weeks of orders, "Last 7 days: 86% accurate" and what that means.

import type { Forecast, ForecastAccuracy, ForecastItem } from '../../types/kitchen';
import { addDays, formatDayShort } from '../../utils/healthTime';

export const FORECAST_DAYS = 7;

/** The days a forecast can be read for: tomorrow first, then the week after it (today last). */
export const forecastDates = (today: string) => [addDays(today, 1), ...Array.from({ length: FORECAST_DAYS - 1 }, (_, n) => addDays(today, n + 2)), today];

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
