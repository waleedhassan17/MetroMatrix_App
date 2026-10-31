// ═══════════════════════════════════════════════════════
// MetroMatrix — Doctor app serializers: profile, practice, queue, calendar,
// appointments, prescriptions, patients and insights
// ═══════════════════════════════════════════════════════
// Shapes: MetroMatrix-API docs/API_HEALTH.md §2 (DoctorAppointment) and
// §4.3. Doctor routes take the appointment CODE, so on this side an
// appointment's `id` is its code. Several screens show what the API serves
// from more than one route; the network fetches them together and hands
// the parts here (see each serializer's input).

import type {
  AvailabilityPreview,
  CalendarItem,
  CalendarRange,
  Completeness,
  ConflictingAppointment,
  DoctorActions,
  DoctorAppointmentDetail,
  DoctorInsights,
  DoctorInsightsRange,
  DoctorLocation,
  DoctorOwnProfile,
  HoursOverlap,
  MedicineSuggestion,
  PatientHistory,
  PatientRow,
  PreviousVisit,
  QueueItem,
  TimeOff,
  TimeRange,
  TimingRow,
  TodaySummary,
  WeekDayHours,
} from '../../models/health';
import { arr, bodiesOf, bodyOf, bool, isObject, num, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { compact, count, iso, money, paged } from '../shopping/common';
import { dateInZone } from '../../utils/health-time/healthTime';
import { completenessFrom } from '../../models/health/doctorProfileModel';
import { appDayFromWeekday } from '../../models/health/availabilityModel';
import { KINDS, TITLE_PREFIX, appointmentStatus, dayOrNull, gender, instant, numOrNull, paymentMethod, paymentStatus, rating, strings, timezone } from './healthCommon';
import { locationSerializer, experienceSerializer } from './discoverySerializer';
import { eventSerializer, locationRefSerializer, paymentSerializer, reasonTags } from './appointmentSerializer';
import { healthRecordSerializer, prescriptionSerializer } from './recordsSerializer';
import { paymentAccountSerializer } from '../shopping/partnerSerializer';

const MINUTE = 60_000;
const JOIN_EARLY_MIN = 10;
const PKT = 'Asia/Karachi';
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// ─── Profile ──────────────────────────────────────────
/**
 * `GET /health/doctor/profile`. `secondarySpecialtySlug` is filled in by the
 * network (the API sends ids; the app works in slugs).
 */
export const ownProfileSerializer = (raw: unknown): DoctorOwnProfile | null => {
  if (!isObject(raw)) return null;
  const primary = isObject(raw.primarySpecialty) ? raw.primarySpecialty : {};
  const pmdc = str(raw.pmdcNumber);
  return {
    title: TITLE_PREFIX[str(raw.title)] ?? 'Dr.',
    name: str(raw.fullName) || str(raw.name),
    gender: gender(raw.gender),
    photoUrl: strOrNull(raw.photoUrl),
    specialtySlug: strOrNull(primary.slug),
    specialtyName: str(primary.name),
    secondarySpecialtySlug: strOrNull(raw.secondarySpecialtySlug),
    practisingSince: numOrNull(raw.practicingSince),
    languages: strings(raw.languages),
    about: str(raw.about),
    qualifications: compact(
      arr(raw.qualifications).map(q => (isObject(q) && str(q.degree) ? { degree: str(q.degree), institute: str(q.institute), year: numOrNull(q.year) } : null)),
    ),
    experience: compact(arr(raw.experiences).map(experienceSerializer)),
    services: strings(raw.services),
    conditionSlugs: compact(arr(raw.conditions).map(c => (isObject(c) ? strOrNull(c.slug) : null))),
    bookingRules: {
      windowDays: count(raw.bookingWindowDays) || 14,
      minNoticeMinutes: count(raw.minNoticeMinutes),
      cancelCutoffHours: Math.round((count(raw.cancelCutoffMinutes) / 60) * 10) / 10,
      videoPrepay: bool(raw.videoPrepayRequired),
    },
    // A doctor who hasn't given a number yet shows an empty field, not the placeholder.
    pmdcNumber: pmdc.startsWith('UNSET-') ? '' : pmdc,
    isListed: bool(raw.isListed),
  };
};

/** `{ percent, missing, isListed }` → the practice set-up checklist. */
export const completenessSerializer = fromResponse((raw: unknown): Completeness | null => {
  if (!isObject(raw)) return null;
  return completenessFrom(strings(raw.missing), num(raw.percent), bool(raw.isListed));
});

// ─── Locations and weekly hours ───────────────────────
/** "24:00" (the API's end of day) reads as 23:59, the last minute the app's time picker has. */
const hhmmIn = (v: unknown) => {
  const s = str(v).slice(0, 5);
  return s === '24:00' ? '23:59' : s;
};

const fmt12 = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  const end = h === 23 && m === 59;
  const hh = end ? 0 : h;
  const mm = end ? 0 : m;
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
};

/** `{ ranges: [{ weekday 0–6, start, end }] }` → Monday-first days with their ranges. */
export const hoursSerializer = (raw: unknown): WeekDayHours[] => {
  const ranges = arr(isObject(raw) ? raw.ranges : raw);
  // The whole week, Monday first; a day with no rows is closed.
  const days: WeekDayHours[] = [1, 2, 3, 4, 5, 6, 7].map(day => ({ day, ranges: [] }));
  for (const r of ranges) {
    if (!isObject(r)) continue;
    const day = appDayFromWeekday(Math.round(num(r.weekday, -1)));
    const range: TimeRange = { from: hhmmIn(r.start), to: hhmmIn(r.end) };
    if (!day || !HHMM.test(range.from) || !HHMM.test(range.to)) continue;
    days[day - 1].ranges.push(range);
  }
  for (const d of days) d.ranges.sort((a, b) => a.from.localeCompare(b.from));
  return days;
};

const DAY_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Weekly hours as the profile's timing rows ("Mon, Wed" · "5:00 PM – 9:00 PM"). */
export const timingsFromHours = (hours: WeekDayHours[]): TimingRow[] => {
  const rows: TimingRow[] = [];
  for (const d of hours) {
    const label = d.ranges.map(r => `${fmt12(r.from)} – ${fmt12(r.to)}`).join(', ');
    if (!label) continue;
    const row = rows.find(r => r.hours === label);
    if (row) row.days = `${row.days}, ${DAY_SHORT[d.day]}`;
    else rows.push({ days: DAY_SHORT[d.day], hours: label });
  }
  return rows;
};

/** One of the doctor's locations; `schedule` is its `GET …/schedule` when the network fetched it. */
export const doctorLocationSerializer = (raw: unknown, schedule?: unknown, videoPrepay = false): DoctorLocation | null => {
  const base = locationSerializer(raw, videoPrepay);
  if (!base) return null;
  const hours = schedule ? hoursSerializer(schedule) : [];
  return { ...base, hours, timings: base.timings.length ? base.timings : timingsFromHours(hours) };
};

/** `{ locations, schedules: { [locationId]: schedule }, videoPrepay }`; closed locations are left out. */
export const doctorLocationsSerializer = (raw: unknown): DoctorLocation[] => {
  const r = isObject(raw) ? raw : {};
  const schedules = isObject(r.schedules) ? r.schedules : {};
  return compact(
    arr(r.locations)
      .filter(l => isObject(l) && l.isActive !== false)
      .map(l => doctorLocationSerializer(l, schedules[str((l as Record<string, unknown>).id)], bool(r.videoPrepay))),
  );
};

/** `409 SCHEDULE_OVERLAP` details `{ conflict: { locationName, weekday } }` → the clash to name. */
export const overlapsFrom = (details: Record<string, unknown> | null | undefined): HoursOverlap[] => {
  const c = isObject(details?.conflict) ? details!.conflict : null;
  if (c && str(c.locationName)) {
    const day = appDayFromWeekday(Math.round(num(c.weekday, -1)));
    return day ? [{ day, otherLocationName: str(c.locationName) }] : [];
  }
  return compact(
    arr(details?.overlaps).map(o =>
      isObject(o) && str(o.otherLocationName) ? { day: Math.round(num(o.day)), otherLocationName: str(o.otherLocationName) } : null,
    ),
  );
};

/** `{ locations: [{ location, days: [{ date, slots: [{ startsAt }] }] }] }` → what patients will see. */
export const previewSerializer = fromResponse((raw: unknown): AvailabilityPreview => {
  const r = isObject(raw) ? raw : {};
  return {
    locations: compact(
      arr(r.locations).map(entry => {
        if (!isObject(entry)) return null;
        const l = isObject(entry.location) ? entry.location : entry;
        if (!str(l.id)) return null;
        return {
          id: str(l.id),
          name: str(l.name),
          kind: oneOf(l.kind, KINDS, 'clinic'),
          timezone: timezone(l.timezone),
          days: compact(
            arr(entry.days).map(d => {
              if (!isObject(d)) return null;
              const date = dayOrNull(d.date);
              return date ? { date, slots: compact(arr(d.slots).map(s => (isObject(s) ? instant(s.startsAt) : instant(s)))) } : null;
            }),
          ),
        };
      }),
    ),
  };
});

// ─── Time off ─────────────────────────────────────────
type LocationLite = { id: string; name: string; kind: 'video' | 'clinic'; timezone: string };

const locationsLite = (raw: unknown): LocationLite[] =>
  compact(
    arr(raw).map(l =>
      isObject(l) && str(l.id)
        ? { id: str(l.id), name: str(l.name, str(l.kind) === 'video' ? 'Video consultation' : 'Clinic'), kind: oneOf(l.kind, KINDS, 'clinic'), timezone: timezone(l.timezone) }
        : null,
    ),
  );

/** `{ id, locationId, startsAt, endsAt, reason }` → whole days in the location's zone (the end is exclusive). */
export const timeOffSerializer = (raw: unknown, locations: LocationLite[] = []): TimeOff | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const start = instant(raw.startsAt);
  const end = instant(raw.endsAt);
  if (!id || !start || !end) return null;
  const loc = locations.find(l => l.id === str(raw.locationId)) ?? null;
  const tz = loc?.timezone ?? PKT;
  return {
    id,
    from: dateInZone(start, tz),
    to: dateInZone(new Date(Math.max(Date.parse(start), Date.parse(end) - MINUTE)).toISOString(), tz),
    locationId: strOrNull(raw.locationId),
    locationName: loc?.name ?? null,
    reason: strOrNull(raw.reason),
  };
};

/** `{ timeOff, locations }` → the time-off list with location names. */
export const timeOffListSerializer = (raw: unknown): TimeOff[] => {
  const r = isObject(raw) ? raw : {};
  const locations = locationsLite(r.locations);
  return compact(arr(Array.isArray(raw) ? raw : r.timeOff).map(t => timeOffSerializer(t, locations)));
};

/** `409 TIME_OFF_CONFLICTS` details `{ appointments: [{ code, startsAt, patientName }] }` → the visits in the way. */
export const conflictsFrom = (details: Record<string, unknown> | null | undefined): ConflictingAppointment[] =>
  compact(
    arr(details?.appointments).map(a => {
      if (!isObject(a)) return null;
      const startAt = instant(a.startsAt ?? a.startAt);
      const code = str(a.code) || str(a.id);
      return code && startAt ? { id: code, code, startAt, timezone: timezone(a.timezone), patientName: str(a.patientName, 'Patient') } : null;
    }),
  );

// ─── The doctor's appointments ────────────────────────
const actionsSerializer = (raw: unknown): DoctorActions => {
  const c = isObject(raw) ? raw : {};
  return {
    canCheckIn: bool(c.checkIn),
    canStart: bool(c.start),
    canComplete: bool(c.complete),
    canNoShow: bool(c.noShow),
    canCancel: bool(c.cancel),
    canConfirmPayment: bool(c.confirmPayment),
    canWritePrescription: bool(c.writePrescription),
    canJoinVideo: bool(c.joinVideo),
  };
};

const patientLite = (raw: unknown) => {
  const r = isObject(raw) ? raw : {};
  return { name: str(r.name, 'Patient'), age: numOrNull(r.age), gender: gender(r.gender) };
};

const joinOpens = (kind: string, startAt: string) =>
  kind === 'video' ? new Date(Date.parse(startAt) - JOIN_EARLY_MIN * MINUTE).toISOString() : null;

/** A `DoctorAppointment` row of the queue or a list; its `id` is the code. */
export const queueItemSerializer = (raw: unknown): QueueItem | null => {
  if (!isObject(raw)) return null;
  const code = str(raw.code);
  const startAt = instant(raw.startsAt);
  if (!code || !startAt) return null;
  const kind = oneOf(raw.kind, KINDS, 'clinic');
  const pay = isObject(raw.payment) ? raw.payment : {};
  const loc = isObject(raw.location) ? raw.location : {};
  const flags = isObject(raw.flags) ? raw.flags : {};
  const actions = actionsSerializer(raw.can);
  return {
    id: code,
    code,
    startAt,
    timezone: timezone(loc.timezone),
    kind,
    status: appointmentStatus(raw.status, pay),
    patient: patientLite(raw.patient),
    firstVisit: bool(flags.firstVisit),
    reason: strOrNull(raw.reason),
    checkedInAt: instant(raw.checkedInAt),
    paymentMethod: paymentMethod(pay.method),
    paymentStatus: paymentStatus(pay),
    locationId: str(loc.id),
    locationName: str(loc.name, kind === 'video' ? 'Video consultation' : 'Clinic'),
    canJoinVideo: kind === 'video' && actions.canJoinVideo,
    joinOpensAt: joinOpens(kind, startAt),
    actions,
  };
};

/** `{ today: { date, counts, queue }, locations }` → the queue screen. */
export const todaySerializer = (raw: unknown): TodaySummary | null => {
  const r = isObject(raw) ? raw : {};
  const t = isObject(r.today) ? r.today : r;
  const date = dayOrNull(t.date);
  if (!date) return null;
  const c = isObject(t.counts) ? t.counts : {};
  const queue = compact(arr(t.queue).map(queueItemSerializer));
  const locations = locationsLite(r.locations);
  return {
    date,
    timezone: locations[0]?.timezone ?? PKT,
    locations: locations.map(({ id, name, kind }) => ({ id, name, kind })),
    counts: {
      booked: count(c.remaining),
      checkedIn: count(c.waiting) + count(c.inConsultation),
      done: count(c.done),
      noShow: queue.filter(q => q.status === 'no_show').length,
    },
    queue,
  };
};

const calendarItemSerializer = (raw: unknown): CalendarItem | null => {
  const q = queueItemSerializer(raw);
  if (!q || !isObject(raw)) return null;
  return {
    id: q.id,
    startAt: q.startAt,
    endAt: instant(raw.endsAt) ?? q.startAt,
    timezone: q.timezone,
    kind: q.kind,
    locationId: q.locationId,
    locationName: q.locationName,
    patientName: q.patient.name,
    status: q.status,
  };
};

/** `{ appointments, timeOff, locations }` → the calendar's range. */
export const calendarSerializer = (raw: unknown): CalendarRange => {
  const r = isObject(raw) ? raw : {};
  const locations = locationsLite(r.locations);
  const rows = isObject(r.appointments) ? r.appointments.items : r.appointments;
  return {
    appointments: compact(arr(rows).map(calendarItemSerializer)),
    timeOff: compact(arr(r.timeOff).map(t => timeOffSerializer(t, locations))),
    locations: locations.map(({ id, name, kind }) => ({ id, name, kind })),
  };
};

/**
 * `history: { previousAppointments: [{ code, startsAt, kind }], prescriptions:
 * [{ id, diagnosis, appointmentCode }] }` → earlier visits with this doctor,
 * newest first, each with its diagnosis when one was written.
 */
const previousVisits = (raw: unknown, exceptCode?: string): PreviousVisit[] => {
  const h = isObject(raw) ? raw : {};
  const rx = new Map(
    compact(arr(h.prescriptions).map(p => (isObject(p) && str(p.appointmentCode) ? ([str(p.appointmentCode), p] as const) : null))),
  );
  return compact(
    arr(h.previousAppointments).map(v => {
      if (!isObject(v)) return null;
      const code = str(v.code);
      const startAt = instant(v.startsAt);
      if (!code || !startAt || code === exceptCode) return null;
      const p = rx.get(code);
      return {
        appointmentId: code,
        code,
        startAt,
        kind: oneOf(v.kind, KINDS, 'clinic'),
        diagnosis: p ? strOrNull(p.diagnosis) : null,
        prescriptionId: p ? strOrNull(p.id) : null,
        notes: null,
      };
    }),
  ).sort((a, b) => b.startAt.localeCompare(a.startAt));
};

/**
 * `{ appointment, notes, prescription }`: the appointment's detail (with
 * `history` and `sharedRecords`), its private notes and its prescription
 * (`{ prescription, locked }`), fetched together.
 */
export const doctorAppointmentSerializer = (raw: unknown): DoctorAppointmentDetail | null => {
  const r = isObject(raw) ? raw : {};
  const a = isObject(r.appointment) ? r.appointment : r;
  const item = queueItemSerializer(a);
  if (!item) return null;
  const p = isObject(a.patient) ? a.patient : {};
  const flags = isObject(a.flags) ? a.flags : {};
  const n = isObject(r.notes) ? r.notes : {};
  const rx = isObject(r.prescription) ? (isObject(r.prescription.prescription) ? r.prescription.prescription : null) : null;
  const history = isObject(a.history) ? a.history : {};
  return {
    id: item.id,
    code: item.code,
    status: item.status,
    kind: item.kind,
    startAt: item.startAt,
    endAt: instant(a.endsAt) ?? item.startAt,
    timezone: item.timezone,
    location: locationRefSerializer(a.location),
    patient: {
      ...patientLite(p),
      id: str(a.patientKey),
      phone: strOrNull(p.phone),
      visitsWithYou: arr(history.previousAppointments).filter(v => isObject(v) && str(v.status) === 'completed').length,
      noShows: count(flags.noShows),
      lateCancels: count(flags.lateCancels),
    },
    reasonTags: reasonTags(a.symptoms),
    reason: strOrNull(a.reason),
    records: compact(arr(a.sharedRecords).map(healthRecordSerializer)),
    previousVisits: previousVisits(history, item.code),
    notes: {
      text: str(n.text),
      attachments: compact(arr(n.files).map(f => (isObject(f) ? strOrNull(f.url) : strOrNull(f)))),
      updatedAt: instant(n.updatedAt),
    },
    payment: paymentSerializer(a.payment, money(a.fee), item.startAt, a.events),
    checkedInAt: item.checkedInAt,
    joinOpensAt: item.joinOpensAt,
    actions: item.actions,
    prescription: rx ? prescriptionSerializer(rx) : null,
    timeline: compact(arr(a.events).map(eventSerializer)),
  };
};

/** `{ medicines: [{ source, name, strength, form }] }` → the writer's suggestions, favourites first. */
export const medicineSuggestionsSerializer = fromResponse((raw: unknown): MedicineSuggestion[] =>
  compact(
    arr(isObject(raw) ? raw.medicines : raw).map(m =>
      isObject(m) && str(m.name)
        ? {
            name: str(m.name),
            strength: str(m.strength),
            form: oneOf(m.form, ['tablet', 'capsule', 'syrup', 'injection', 'drops', 'cream', 'other'] as const, 'tablet'),
            isFavourite: str(m.source) === 'favourite' || bool(m.isFavourite),
          }
        : null,
    ),
  ).sort((a, b) => Number(b.isFavourite) - Number(a.isFavourite)));

/** `{ patientKey, name, age, gender, visits, lastVisitAt }`. */
export const patientRowSerializer = (raw: unknown): PatientRow | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.patientKey) || str(raw.id);
  if (!id) return null;
  return { id, ...patientLite(raw), lastVisitAt: iso(instant(raw.lastVisitAt)), visits: count(raw.visits) };
};

/** `{ patientKey, name, …, previousAppointments, prescriptions }` → the person and their visits with this doctor. */
export const patientHistorySerializer = fromResponse((raw: unknown): PatientHistory | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.patientKey);
  if (!id) return null;
  return { patient: { id, ...patientLite(raw) }, visits: previousVisits(raw) };
});

/** The insights the doctor's chart and tiles show (fees are recorded by the doctor, never held). */
export const insightsSerializer = fromResponse((raw: unknown): DoctorInsights | null => {
  if (!isObject(raw)) return null;
  const totals = isObject(raw.totals) ? raw.totals : {};
  const times = isObject(raw.times) ? raw.times : {};
  const fees = isObject(raw.fees) ? raw.fees : {};
  return {
    range: oneOf(raw.range, ['7d', '30d', '90d'] as readonly DoctorInsightsRange[], '30d'),
    perDay: compact(
      arr(raw.perDay).map(d => {
        if (!isObject(d)) return null;
        const date = dayOrNull(d.date);
        return date ? { date, video: count(d.video), clinic: count(d.clinic) } : null;
      }),
    ),
    outcomes: { completed: count(totals.completed), cancelled: count(totals.cancelled), noShow: count(totals.noShow) },
    avgWaitMinutes: numOrNull(times.avgWaitMinutes),
    ratingTrend: compact(
      arr(raw.ratingTrend).map(d => {
        if (!isObject(d)) return null;
        const date = dayOrNull(d.date);
        const r = rating(d.average);
        return date && r !== null ? { date, rating: r } : null;
      }),
    ),
    recordedFees: money(fees.recorded),
    appointments: count(totals.appointments),
  };
});

/** A page of patientRows, as the API answers it. */
export const patientRowPageSerializer = fromResponse(raw => paged(raw, patientRowSerializer));

// ─── The doctor app's reads, several answers together ──────────

/** Only one location's patients, when the doctor picked one. */
const forLocation = (today: unknown, locationId: string | null) => {
  if (!locationId || !isObject(today)) return today;
  return { ...today, queue: arr(today.queue).filter(q => isObject(q) && isObject(q.location) && str(q.location.id) === locationId) };
};

/**
 * The doctor's day with the practice's locations: today's queue (GET
 * /health/doctor/today), or another date's appointments (`date`) shaped as one.
 */
export const doctorDaySerializer = (parts: { day: unknown; locations: unknown }, date: string | null, locationId: string | null) => {
  const { day, locations } = bodiesOf(parts);
  const today = date ? { date, counts: {}, queue: arr(isObject(day) ? day.items : []) } : day;
  return todaySerializer({ today: forLocation(today, locationId), locations });
};

/** The locations still in use (their ids are what the schedules are read for). */
export const activeLocations = (raw: unknown): Record<string, unknown>[] =>
  arr(bodyOf(raw)).filter(l => isObject(l) && l.isActive !== false) as Record<string, unknown>[];

/** The practice's locations with their weekly hours; the video prepay rule is the profile's. */
export const practiceLocationsSerializer = (parts: { locations: unknown; schedules: Record<string, unknown>; profile: unknown }) => {
  const profile = bodyOf(parts.profile);
  return doctorLocationsSerializer({
    locations: activeLocations(parts.locations),
    schedules: Object.fromEntries(Object.entries(parts.schedules).map(([id, s]) => [id, bodyOf(s)])),
    videoPrepay: isObject(profile) && bool(profile.videoPrepayRequired),
  });
};

/** A location as create or update answers it, with the prepay rule the form set. */
export const savedLocationSerializer = (raw: unknown, videoPrepay: boolean) => doctorLocationSerializer(bodyOf(raw), undefined, videoPrepay);

/** A location after its hours were saved: found in the list, with the saved week. */
export const savedHoursSerializer = (parts: { schedule: unknown; locations: unknown }, id: string) => {
  const { schedule, locations } = bodiesOf(parts);
  return doctorLocationSerializer(arr(locations).find(l => isObject(l) && str(l.id) === id), schedule);
};

/** The timezone time off is counted in: the location's, else Pakistan time. */
export const locationTimezone = (locations: unknown, locationId: string | null): string => {
  const place = arr(bodyOf(locations)).find(l => isObject(l) && str(l.id) === locationId);
  return (isObject(place) && str(place.timezone)) || PKT;
};

/** Time off just added, named with the practice's locations. */
export const addedTimeOffSerializer = (parts: { created: unknown; locations: unknown }) => {
  const { created, locations } = bodiesOf(parts);
  return timeOffSerializer(
    created,
    compact(arr(locations).map(l => (isObject(l) ? { id: str(l.id), name: str(l.name), kind: 'clinic' as const, timezone: str(l.timezone) || PKT } : null))),
  );
};

/** The doctor's own accounts patients pay into: `{ kind, accountTitle, accountNumber, bankName }`. */
const accountIn = (raw: unknown) => (isObject(raw) ? paymentAccountSerializer({ ...raw, title: raw.accountTitle, number: raw.accountNumber }) : null);
export const doctorPaymentAccountSerializer = fromResponse(accountIn);
export const doctorPaymentAccountListSerializer = fromResponse(raw => compact(arr(raw).map(accountIn)));

/** GET /health/doctor/diagnoses/recent. */
export const recentDiagnosesSerializer = fromResponse(strings);

/** A prescription's appointment code (editing re-issues it there). */
export const prescriptionAppointmentCodeSerializer = fromResponse(raw => (isObject(raw) ? str(raw.appointmentCode) : ''));
