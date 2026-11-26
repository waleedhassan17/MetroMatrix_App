// ═══════════════════════════════════════════════════════
// MetroMatrix — The doctor's calendar: which appointments a view asks for
// ═══════════════════════════════════════════════════════
// The API reads `date` as one Pakistan-time day and `from`/`to` as instants
// with `to` exclusive (consultation.service list). Asking for a day as
// `from == to` (dates) answered nothing at all (the 2026-11-26 QA), so a day
// asks by `date` and a week by the exact instants of its seven days.

import { PKT, addDays, hourOfDay, weekStart, zonedToIso } from '../../utils/health-time/healthTime';

export type CalendarMode = 'day' | 'week';

export type CalendarQuery = { date: string } | { from: string; to: string };

/** The appointments query for the day or week that `date` falls in. */
export const calendarQuery = (date: string, mode: CalendarMode): CalendarQuery => {
  if (mode === 'day') return { date };
  const first = weekStart(date);
  return { from: zonedToIso(first, '00:00', PKT), to: zonedToIso(addDays(first, 7), '00:00', PKT) };
};

/** The part of the day a visit falls in, for the agenda's groups. */
export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

export const DAY_PART_LABEL: Record<DayPart, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
};

export const dayPartOf = (iso: string, timezone: string): DayPart => {
  const h = hourOfDay(iso, timezone);
  if (h < 5) return 'night';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
};

/** Visits grouped by part of the day, in time order (empty parts left out). */
export const byDayPart = <T extends { startAt: string; timezone: string }>(items: T[]): { part: DayPart; items: T[] }[] => {
  const order: DayPart[] = ['morning', 'afternoon', 'evening', 'night'];
  const sorted = [...items].sort((a, b) => a.startAt.localeCompare(b.startAt));
  return order
    .map(part => ({ part, items: sorted.filter(i => dayPartOf(i.startAt, i.timezone) === part) }))
    .filter(g => g.items.length > 0);
};
