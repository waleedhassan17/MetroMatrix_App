// ═══════════════════════════════════════════════════════
// MetroMatrix — Weekly hours and time off (doctor's availability)
// ═══════════════════════════════════════════════════════
// Hours are "HH:mm" ranges per weekday (1 = Monday … 7 = Sunday) in the
// location's timezone. The server is the judge of overlaps across clinics;
// these checks give the same answer inline, before saving.

import type { DoctorLocation, DoctorLocationInput, HoursOverlap, TimeOffInput, TimeRange, WeekDayHours } from '../health';
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

const hhmmOf = (minutes: number) => (minutes >= 1440 ? '23:59' : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);

/**
 * "Add a break": the last range splits around its middle with an hour off
 * (9:00–17:00 → 9:00–13:00 and 14:00–17:00). A range too short to split (under
 * 3 hours) gets a second one an hour after it ends instead, three hours long
 * at most; a day with nothing gets the usual evening.
 */
export const withBreak = (ranges: TimeRange[]): TimeRange[] => {
  const last = ranges[ranges.length - 1];
  if (!last) return [{ ...DEFAULT_RANGE }];
  const from = toMinutes(last.from);
  const to = last.to === '23:59' ? 1440 : toMinutes(last.to);
  if (to - from >= 180) {
    const mid = Math.round((from + (to - from) / 2 - 30) / 60) * 60;
    return [...ranges.slice(0, -1), { from: last.from, to: hhmmOf(mid) }, { from: hhmmOf(mid + 60), to: last.to }];
  }
  const start = to + 60;
  if (start >= 1440 - 30) return ranges;
  return [...ranges, { from: hhmmOf(start), to: hhmmOf(Math.min(1440, start + 180)) }];
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
export const copyToWeekdays = (hours: WeekDayHours[], day: number): WeekDayHours[] =>
  copyToDays(hours, day, [1, 2, 3, 4, 5, 6].filter(d => d !== day));

/** Copy `day`'s ranges onto each of `targets` (any days the doctor ticks). */
export const copyToDays = (hours: WeekDayHours[], day: number, targets: number[]): WeekDayHours[] => {
  const source = hours.find(h => h.day === day)?.ranges ?? [];
  return normaliseWeek(hours).map(h => (h.day !== day && targets.includes(h.day) ? { ...h, ranges: source.map(r => ({ ...r })) } : h));
};

/** A range's length in minutes; "23:59" is the end of the day. */
const rangeMinutes = (r: TimeRange) => (r.to === '23:59' ? 1440 : toMinutes(r.to)) - toMinutes(r.from);

/** How many `slotMinutes` slots fit in a range (what patients can book there). */
/** Slots a range makes, a slot plus the break after it apart (the API's grid). */
export const slotsInRange = (r: TimeRange, slotMinutes: number, bufferMinutes = 0): number => {
  if (!HHMM.test(r.from) || !HHMM.test(r.to) || slotMinutes <= 0) return 0;
  const m = rangeMinutes(r);
  return m < slotMinutes ? 0 : Math.floor((m - slotMinutes) / (slotMinutes + Math.max(0, bufferMinutes))) + 1;
};

/** Slots a day, and a week, holds. */
export const daySlotCount = (d: WeekDayHours, slotMinutes: number, bufferMinutes = 0) =>
  d.ranges.reduce((n, r) => n + slotsInRange(r, slotMinutes, bufferMinutes), 0);
export const weeklySlotCount = (hours: WeekDayHours[], slotMinutes: number, bufferMinutes = 0) =>
  hours.reduce((n, d) => n + daySlotCount(d, slotMinutes, bufferMinutes), 0);

/** The breaks a doctor can leave after each patient. */
export const BUFFER_CHOICES = [0, 5, 10, 15] as const;

/** Same hours on every day of two weeks (the unsaved-changes check). */
export const sameWeek = (a: WeekDayHours[], b: WeekDayHours[]) => JSON.stringify(normaliseWeek(a)) === JSON.stringify(normaliseWeek(b));

/**
 * Errors for one location's week, keyed `day.<d>.<i>` (a bad or clashing
 * range). Ranges within a day must be valid, end after they start and not
 * overlap each other.
 */
export const validateWeek = (hours: WeekDayHours[], slotMinutes = 15): ValidationErrors => {
  const errors: ValidationErrors = {};
  for (const h of hours) {
    h.ranges.forEach((r, i) => {
      if (!HHMM.test(r.from) || !HHMM.test(r.to)) errors[`day.${h.day}.${i}`] = 'Choose a start and an end time';
      else if (rangeMinutes(r) <= 0) errors[`day.${h.day}.${i}`] = 'The end time is before the start';
      // A range shorter than a slot can never be booked.
      else if (rangeMinutes(r) < slotMinutes) errors[`day.${h.day}.${i}`] = `Shorter than one ${slotMinutes}-minute slot`;
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

/** The API's limit (CreateTimeOffDto.reason). */
export const MAX_TIME_OFF_REASON = 200;

export const validateTimeOff = (t: TimeOffInput, today: string): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.from)) errors.from = 'Choose the first day';
  else if (t.from < today) errors.from = 'Choose today or a later day';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.to)) errors.to = 'Choose the last day';
  else if (t.from && t.to < t.from) errors.to = 'The last day is before the first';
  if ((t.reason ?? '').length > MAX_TIME_OFF_REASON) errors.reason = `Keep it under ${MAX_TIME_OFF_REASON} characters`;
  if (t.hours) {
    delete errors.to;
    if (!HHMM.test(t.hours.from) || !HHMM.test(t.hours.to)) errors.hours = 'Choose the start and end';
    else if (rangeMinutes(t.hours) <= 0) errors.hours = 'The end is before the start';
  }
  return errors;
};

/** The location form: the fee is empty (null) until typed, never quietly Rs 0. */
export type DoctorLocationForm = Omit<DoctorLocationInput, 'fee'> & { fee: number | null };

/** The API's own limits for a location (practice/dto/practice.dto.ts). */
export const LOCATION_LIMITS = { name: 140, area: 80, city: 60, address: 255, instructions: 500 } as const;
const PK_PHONE = /^\+92\d{10}$/;

export const validateLocation = (l: Pick<DoctorLocationForm, 'kind' | 'name' | 'area' | 'city' | 'address' | 'fee' | 'slotMinutes' | 'phone' | 'instructions'>): ValidationErrors => {
  const errors: ValidationErrors = {};
  const name = l.name.trim();
  if (name.length < 2) errors.name = l.kind === 'video' ? 'Name it, for example "Video consultation"' : 'Enter the clinic or hospital name';
  else if (name.length > LOCATION_LIMITS.name) errors.name = `Keep it under ${LOCATION_LIMITS.name} characters`;
  if (l.kind === 'clinic') {
    if (l.area.trim().length < 2) errors.area = 'Enter the area, for example Gulberg';
    if (l.city.trim().length < 2) errors.city = 'Enter the city';
    // The API needs a street address for a clinic, at least 5 characters.
    const address = (l.address ?? '').trim();
    if (address.length < 5) errors.address = 'Enter the street address, for example 42-B Main Boulevard (at least 5 characters)';
    else if (address.length > LOCATION_LIMITS.address) errors.address = `Keep it under ${LOCATION_LIMITS.address} characters`;
    if (l.phone && !PK_PHONE.test(l.phone)) errors.phone = 'Enter a Pakistani number, for example 300 1234567';
  }
  if (l.fee === null) errors.fee = 'Enter the fee in rupees (0 if it is free)';
  else if (!Number.isInteger(l.fee) || l.fee < 0) errors.fee = 'Enter the fee in rupees';
  else if (l.fee > 50000) errors.fee = 'The fee looks too high';
  if (!SLOT_LENGTHS.includes(l.slotMinutes)) errors.slotMinutes = 'Choose a slot length';
  if ((l.instructions ?? '').length > LOCATION_LIMITS.instructions) errors.instructions = `Keep it under ${LOCATION_LIMITS.instructions} characters`;
  return errors;
};

/** The API's field names → the location form's ("addressLine" → "address"). */
export const locationFieldKey = (apiField: string): string => ({ addressLine: 'address' })[apiField] ?? apiField;

/** A day's own hours, checked like a week's day (start before end, room for a slot, no overlap). */
export const validateDayHours = (closed: boolean, ranges: TimeRange[], slotMinutes = 15): ValidationErrors => {
  if (closed) return {};
  if (!ranges.length) return { ranges: 'Add the hours, or close the day' };
  const errors: ValidationErrors = {};
  for (const [k, v] of Object.entries(validateWeek([{ day: 1, ranges }], slotMinutes))) errors[k.replace('day.1.', 'range.')] = v;
  return errors;
};

/** A day-hours note's limit (the API's). */
export const MAX_DAY_NOTE = 200;
