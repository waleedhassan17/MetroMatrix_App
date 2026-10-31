// MetroMatrix — Food vendor insights: ranges and how the numbers read.
// Recorded sales are orders the kitchen marked delivered or collected;
// customers paid the kitchen directly, so they are records, never earnings.

import type { FoodInsights, FoodInsightsRange } from '../../types/food';
import { rejectReasonLabel } from './foodStatusModel';

export const INSIGHT_RANGES: { key: FoodInsightsRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
];

/** "92%"; "—" with no data yet. */
export const percentLabel = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);

/** "45 sec" or "3 min" to answer a new order. */
export const answerTimeLabel = (seconds: number | null) =>
  seconds === null ? '—' : seconds < 90 ? `${Math.round(seconds)} sec` : `${Math.round(seconds / 60)} min`;

export const minutesLabel = (minutes: number | null) => (minutes === null ? '—' : `${Math.round(minutes)} min`);

/** Why orders ended: the kitchen's reject keys in words. */
export const cancelReasonText = (c: FoodInsights['cancelReasons'][number]) => {
  const why = c.status === 'rejected' ? rejectReasonLabel(c.reason) : c.reason;
  const who = c.status === 'rejected' ? 'Declined' : c.status === 'auto_rejected' ? 'Not answered in time' : 'Cancelled';
  return why ? `${who}: ${why}` : who;
};

/** Nothing happened in the range: show one calm line instead of empty charts. */
export const isQuiet = (i: FoodInsights) => i.totals.orders === 0;
