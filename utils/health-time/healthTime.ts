// ═══════════════════════════════════════════════════════
// MetroMatrix — Appointment time, always in the PRACTICE's timezone
// ═══════════════════════════════════════════════════════
// Every Health screen shows time through this file, never through
// `new Date().toLocale…`. A slot at a Lahore clinic reads "6:15 PM" whether
// the phone is set to Karachi, Dubai or London, because each time is shifted
// by the location's own UTC offset (from the API) before it is formatted.
//
// The shift is computed from Intl where the engine has the zone, with a
// fixed table as the fallback (Pakistan has kept UTC+5 with no daylight
// saving since 2009), so Hermes builds without full ICU still agree.

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export const PKT = 'Asia/Karachi';
const FIXED_OFFSETS: Record<string, number> = { 'Asia/Karachi': 300, UTC: 0, 'Etc/UTC': 0 };
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Minutes the zone is ahead of UTC at `atMs`. */
export const zoneOffsetMinutes = (timezone: string, atMs: number): number => {
  if (timezone in FIXED_OFFSETS) return FIXED_OFFSETS[timezone];
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(new Date(atMs));
    const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
    const offset = Math.round((asUtc - Math.floor(atMs / MINUTE) * MINUTE) / MINUTE);
    return Number.isFinite(offset) ? offset : FIXED_OFFSETS[PKT];
  } catch {
    return FIXED_OFFSETS[PKT];
  }
};

/** A dayjs whose UTC fields read as the wall clock in `timezone`. */
const wall = (iso: string, timezone: string) => {
  const ms = Date.parse(iso);
  return dayjs.utc(ms + zoneOffsetMinutes(timezone, ms) * MINUTE);
};

/** A "YYYY-MM-DD" day (no zone) as a dayjs at its midnight. */
const day = (date: string) => dayjs.utc(`${date}T00:00:00Z`);

/** "6:15 PM" */
export const formatSlot = (iso: string, timezone: string) => wall(iso, timezone).format('h:mm A');

/** "Thu 15 Oct, 6:15 PM" (the booking button, cards). */
export const formatWhen = (iso: string, timezone: string) => wall(iso, timezone).format('ddd D MMM, h:mm A');

/** "Thursday 15 October 2026" */
export const formatLongDate = (iso: string, timezone: string) => wall(iso, timezone).format('dddd D MMMM YYYY');

/** "6:15 PM – 6:30 PM" */
export const formatTimeRange = (startIso: string, endIso: string, timezone: string) =>
  `${formatSlot(startIso, timezone)} – ${formatSlot(endIso, timezone)}`;

/** A day chip: "Thu" over "15", and "Oct" for the month. */
export const formatDayChip = (date: string) => {
  const d = day(date);
  return { weekday: d.format('ddd'), day: d.format('D'), month: d.format('MMM'), long: d.format('dddd D MMMM') };
};

/** "Fri 17 Oct" for a zone-free day. */
export const formatDayShort = (date: string) => day(date).format('ddd D MMM');

/** "17 Oct 2026" for a zone-free day (record dates, date of birth). */
export const formatDayFull = (date: string) => day(date).format('D MMM YYYY');

/** The appointment card's date block: day number and month. */
export const dateBlock = (iso: string, timezone: string) => {
  const d = wall(iso, timezone);
  return { day: d.format('D'), month: d.format('MMM'), weekday: d.format('ddd') };
};

/** "Thursday 15 October, 6:15 PM, available" — a slot pill's screen-reader label. */
export const slotA11yLabel = (iso: string, timezone: string, available = true) =>
  `${wall(iso, timezone).format('dddd D MMMM, h:mm A')}, ${available ? 'available' : 'unavailable'}`;

/** The "YYYY-MM-DD" the instant falls on in `timezone`. */
export const dateInZone = (iso: string, timezone: string) => wall(iso, timezone).format('YYYY-MM-DD');

/** Today's "YYYY-MM-DD" in `timezone`. */
export const todayInZone = (timezone: string, now: number = Date.now()) => dateInZone(new Date(now).toISOString(), timezone);

/** `date` plus `n` days, as "YYYY-MM-DD". */
export const addDays = (date: string, n: number) => day(date).add(n, 'day').format('YYYY-MM-DD');

/** Monday of the week `date` is in. */
export const weekStart = (date: string) => {
  const d = day(date);
  const iso = (d.day() + 6) % 7; // Monday = 0
  return d.subtract(iso, 'day').format('YYYY-MM-DD');
};

/** ISO weekday of a "YYYY-MM-DD": 1 = Monday … 7 = Sunday. */
export const isoWeekday = (date: string) => ((day(date).day() + 6) % 7) + 1;

/** "HH:mm" on `date` in `timezone` → the UTC instant (ISO). */
export const zonedToIso = (date: string, hhmm: string, timezone: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const asIfUtc = Date.parse(`${date}T00:00:00Z`) + (h || 0) * HOUR + (m || 0) * MINUTE;
  return new Date(asIfUtc - zoneOffsetMinutes(timezone, asIfUtc) * MINUTE).toISOString();
};

/** Hours since that day's midnight in `timezone` (calendar block position). */
export const hourOfDay = (iso: string, timezone: string) => {
  const d = wall(iso, timezone);
  return d.hour() + d.minute() / 60;
};

/**
 * "Starts now", "in 45 min", "in 2 h 15 min", "Tomorrow", "in 3 days", or
 * null once the appointment is over (or started more than its length ago).
 */
export const relativeStart = (startIso: string, now: number = Date.now(), endIso?: string): string | null => {
  const start = Date.parse(startIso);
  const end = endIso ? Date.parse(endIso) : start + 30 * MINUTE;
  if (now >= end) return null;
  const ms = start - now;
  if (ms <= MINUTE) return 'Starts now';
  const minutes = Math.ceil(ms / MINUTE);
  if (minutes < 60) return `in ${minutes} min`;
  if (ms < DAY) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `in ${h} h ${m} min` : `in ${h} h`;
  }
  const days = Math.round(ms / DAY);
  return days <= 1 ? 'Tomorrow' : `in ${days} days`;
};

/** "12 min" / "1 h 5 min" since `iso` (the waiting timer). */
export const elapsed = (iso: string, now: number = Date.now()) => {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / MINUTE));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

/** Whole years between a "YYYY-MM-DD" birth date and `now`, or null. */
export const ageFrom = (dateOfBirth: string | null, now: number = Date.now()): number | null => {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}/.test(dateOfBirth)) return null;
  const today = dayjs.utc(now);
  const dob = day(dateOfBirth.slice(0, 10));
  const years = today.diff(dob, 'year');
  return years >= 0 && years < 130 ? years : null;
};

/** "15 Oct 2026" — the day an instant falls on at the practice (reviews, records, prescriptions). */
export const formatOn = (iso: string, timezone: string = PKT) => formatDayFull(dateInZone(iso, timezone));
