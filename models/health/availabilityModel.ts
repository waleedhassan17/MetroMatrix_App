// ═══════════════════════════════════════════════════════
// MetroMatrix — Weekly hours and time off (doctor's availability)
// ═══════════════════════════════════════════════════════
// Hours are "HH:mm" ranges per weekday (1 = Monday … 7 = Sunday) in the
// location's timezone. The server is the judge of overlaps across clinics;
// these checks give the same answer inline, before saving.

import type { DoctorLocation, HoursOverlap, TimeOffInput, TimeRange, WeekDayHours } from '../health';
import type { ValidationErrors } from '../authModel';

export const WEEKDAYS: { day: number; short: string; long: string }[] = [
  { day: 1, short: 'Mon', long: 'Monday' },
  { day: 2, short: 'Tue', long: 'Tuesday' },
  { day: 3, short: 'Wed', long: 'Wednesday' },
  { day: 4, short: 'Thu', long: 'Thursday' },
  { day: 5, short: 'Fri', long: 'Friday' },
  { day: 6, short: 'Sat', long: 'Saturday' },
  { day: 7, short: 'Sun', long: 'Sunday' },
];

export const weekdayName = (day: number) => WEEKDAYS.find(w => w.day === day)?.long ?? 'Day';

/**
 * The app's days run 1 (Monday) … 7 (Sunday); the API's weekdays 0 (Sunday)
 * … 6 (Saturday). Null for anything else.
 */
export const appDayFromWeekday = (weekday: number): number | null =>
  Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? (weekday === 0 ? 7 : weekday) : null;

export const weekdayFromAppDay = (day: number): number => (day === 7 ? 0 : day);

/** The week as the API's schedule body: `[{ weekday, start, end }]` (23:59 ends the day as "24:00"). */
export const scheduleBody = (hours: WeekDayHours[]) =>
  hours.flatMap(d => d.ranges.map(r => ({ weekday: weekdayFromAppDay(d.day), start: r.from, end: r.to === '23:59' ? '24:00' : r.to })));

export const SLOT_LENGTHS = [10, 15, 20, 30, 45, 60];
export const DEFAULT_RANGE: TimeRange = { from: '17:00', to: '21:00' };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** "17:30" → "5:30 PM" (wall time; no zone involved). */
export const formatHHmm = (hhmm: string) => {
  if (!HHMM.test(hhmm)) return hhmm;
  const total = toMinutes(hhmm);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export const rangesOverlap = (a: TimeRange, b: TimeRange) => toMinutes(a.from) < toMinutes(b.to) && toMinutes(b.from) < toMinutes(a.to);

export const emptyWeek = (): WeekDayHours[] => WEEKDAYS.map(w => ({ day: w.day, ranges: [] }));

/** Every weekday present once, ranges sorted by start. */
export const normaliseWeek = (hours: WeekDayHours[]): WeekDayHours[] =>
  WEEKDAYS.map(w => ({
    day: w.day,
    ranges: [...(hours.find(h => h.day === w.day)?.ranges ?? [])].sort((a, b) => toMinutes(a.from) - toMinutes(b.from)),
  }));

/** Copy `day`'s ranges to every other weekday (Mon–Sat; Sunday stays as it is). */
export const copyToWeekdays = (hours: WeekDayHours[], day: number): WeekDayHours[] => {
  const source = hours.find(h => h.day === day)?.ranges ?? [];
  return normaliseWeek(hours).map(h => (h.day === 7 || h.day === day ? h : { ...h, ranges: source.map(r => ({ ...r })) }));
};

/**
 * Errors for one location's week, keyed `day.<d>.<i>` (a bad or clashing
 * range). Ranges within a day must be valid, end after they start and not
 * overlap each other.
 */
export const validateWeek = (hours: WeekDayHours[]): ValidationErrors => {
  const errors: ValidationErrors = {};
  for (const h of hours) {
    h.ranges.forEach((r, i) => {
      if (!HHMM.test(r.from) || !HHMM.test(r.to)) errors[`day.${h.day}.${i}`] = 'Use times like 09:00';
      else if (toMinutes(r.to) <= toMinutes(r.from)) errors[`day.${h.day}.${i}`] = 'The end time is before the start';
      else if (toMinutes(r.to) - toMinutes(r.from) < 15) errors[`day.${h.day}.${i}`] = 'At least 15 minutes';
      else if (h.ranges.some((o, j) => j !== i && rangesOverlap(r, o))) errors[`day.${h.day}.${i}`] = 'Overlaps another range';
    });
  }
  return errors;
};

/** Where `hours` (for location `id`) clash with the doctor's other locations. */
export const crossLocationOverlaps = (id: string, hours: WeekDayHours[], others: Pick<DoctorLocation, 'id' | 'name' | 'hours'>[]): HoursOverlap[] => {
  const out: HoursOverlap[] = [];
  for (const h of hours) {
    for (const other of others) {
      if (other.id === id) continue;
      const theirs = other.hours.find(x => x.day === h.day)?.ranges ?? [];
      if (h.ranges.some(r => theirs.some(t => rangesOverlap(r, t))) && !out.some(o => o.day === h.day && o.otherLocationName === other.name)) {
        out.push({ day: h.day, otherLocationName: other.name });
      }
    }
  }
  return out;
};

/** "Overlaps Thursday at Gulberg Clinic". */
export const overlapMessage = (o: HoursOverlap) => `Overlaps ${weekdayName(o.day)} hours at ${o.otherLocationName}`;

export const validateTimeOff = (t: TimeOffInput, today: string): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.from)) errors.from = 'Choose the first day';
  else if (t.from < today) errors.from = 'Choose today or a later day';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.to)) errors.to = 'Choose the last day';
  else if (t.from && t.to < t.from) errors.to = 'The last day is before the first';
  if ((t.reason ?? '').length > 120) errors.reason = 'Keep it under 120 characters';
  return errors;
};

export const validateLocation = (l: {
  kind: 'video' | 'clinic';
  name: string;
  area: string;
  city: string;
  fee: number;
  slotMinutes: number;
  phone: string | null;
}): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (l.name.trim().length < 2) errors.name = l.kind === 'video' ? 'Name it, for example "Video consultation"' : 'Enter the clinic or hospital name';
  if (l.kind === 'clinic' && l.area.trim().length < 2) errors.area = 'Enter the area, for example Gulberg';
  if (l.kind === 'clinic' && l.city.trim().length < 2) errors.city = 'Enter the city';
  if (!Number.isInteger(l.fee) || l.fee < 0) errors.fee = 'Enter the fee in rupees';
  else if (l.fee > 50000) errors.fee = 'The fee looks too high';
  if (!SLOT_LENGTHS.includes(l.slotMinutes)) errors.slotMinutes = 'Choose a slot length';
  return errors;
};
