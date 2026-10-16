// MetroMatrix — Doctor app serializers: profile, practice, queue, calendar,
// appointments, prescriptions, patients, reviews and insights.
// TODO(API_HEALTH): shapes from docs/API_HEALTH_ASSUMED.md.

import type {
  AvailabilityPreview,
  CalendarItem,
  CalendarRange,
  Completeness,
  CompletenessKey,
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
  TodaySummary,
  WeekDayHours,
} from '../../types/health';
import { arr, bool, isObject, num, oneOf, str, strOrNull } from '../serializerUtils';
import { compact, count, iso, isoOrNull, money } from '../shopping/common';
import { KINDS, dayOrNull, gender, numOrNull, rating, strings, timezone } from './healthCommon';
import { locationSerializer } from './discoverySerializer';
import {
  APPOINTMENT_PAYMENT_STATUSES,
  APPOINTMENT_STATUSES,
  eventSerializer,
  locationRefSerializer,
  paymentSerializer,
  reasonTags,
} from './appointmentSerializer';
import { healthRecordSerializer, prescriptionSerializer } from './recordsSerializer';

const COMPLETENESS: readonly CompletenessKey[] = ['photo', 'about', 'qualifications', 'services', 'location', 'hours', 'preview'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const ownProfileSerializer = (raw: unknown): DoctorOwnProfile | null => {
  if (!isObject(raw)) return null;
  const rules = isObject(raw.bookingRules) ? raw.bookingRules : {};
  return {
    title: str(raw.title, 'Dr.'),
    name: str(raw.name),
    gender: gender(raw.gender),
    photoUrl: strOrNull(raw.photoUrl),
    specialtySlug: strOrNull(raw.specialtySlug),
    secondarySpecialtySlug: strOrNull(raw.secondarySpecialtySlug),
    practisingSince: numOrNull(raw.practisingSince),
    languages: strings(raw.languages),
    about: str(raw.about),
    qualifications: compact(
      arr(raw.qualifications).map(q => (isObject(q) ? { degree: str(q.degree), institute: str(q.institute), year: numOrNull(q.year) } : null)),
    ),
    experience: compact(
      arr(raw.experience).map(e => (isObject(e) ? { role: str(e.role), place: str(e.place), from: numOrNull(e.from), to: numOrNull(e.to) } : null)),
    ),
    services: strings(raw.services),
    conditionSlugs: strings(raw.conditionSlugs),
    bookingRules: {
      windowDays: count(rules.windowDays) || 14,
      minNoticeMinutes: count(rules.minNoticeMinutes),
      cancelCutoffHours: count(rules.cancelCutoffHours),
      videoPrepay: bool(rules.videoPrepay),
    },
    pmdcNumber: str(raw.pmdcNumber),
    isListed: bool(raw.isListed),
  };
};

export const completenessSerializer = (raw: unknown): Completeness | null => {
  if (!isObject(raw)) return null;
  const items = compact(
    arr(raw.items).map(i => {
      if (!isObject(i)) return null;
      const key = oneOf(i.key, COMPLETENESS, null);
      return key ? { key, label: str(i.label, key), done: bool(i.done) } : null;
    }),
  );
  const percent = Math.min(100, Math.max(0, Math.round(num(raw.percent, items.length ? (items.filter(i => i.done).length / items.length) * 100 : 0))));
  return { items, percent, isListed: bool(raw.isListed), canPublish: bool(raw.canPublish) && percent === 100 };
};

const rangeSerializer = (raw: unknown): TimeRange | null =>
  isObject(raw) && HHMM.test(str(raw.from)) && HHMM.test(str(raw.to)) ? { from: str(raw.from), to: str(raw.to) } : null;

export const hoursSerializer = (raw: unknown): WeekDayHours[] =>
  compact(
    arr(raw).map(h => {
      if (!isObject(h)) return null;
      const day = Math.round(num(h.day));
      return day >= 1 && day <= 7 ? { day, ranges: compact(arr(h.ranges).map(rangeSerializer)) } : null;
    }),
  );

export const doctorLocationSerializer = (raw: unknown): DoctorLocation | null => {
  const base = locationSerializer(raw);
  if (!base || !isObject(raw)) return null;
  return { ...base, hours: hoursSerializer(raw.hours) };
};

export const doctorLocationsSerializer = (raw: unknown): DoctorLocation[] => compact(arr(raw).map(doctorLocationSerializer));

/** `VALIDATION_FAILED` details.overlaps → named clashes. */
export const overlapsFrom = (details: Record<string, unknown> | null | undefined): HoursOverlap[] =>
  compact(
    arr(details?.overlaps).map(o =>
      isObject(o) && str(o.otherLocationName) ? { day: Math.round(num(o.day)), otherLocationName: str(o.otherLocationName) } : null,
    ),
  );

export const previewSerializer = (raw: unknown): AvailabilityPreview => {
  const r = isObject(raw) ? raw : {};
  return {
    locations: compact(
      arr(r.locations).map(l => {
        if (!isObject(l) || !str(l.id)) return null;
        return {
          id: str(l.id),
          name: str(l.name),
          kind: oneOf(l.kind, KINDS, 'clinic'),
          timezone: timezone(l.timezone),
          days: compact(
            arr(l.days).map(d => {
              if (!isObject(d)) return null;
              const date = dayOrNull(d.date);
              return date ? { date, slots: compact(arr(d.slots).map(isoOrNull)) } : null;
            }),
          ),
        };
      }),
    ),
  };
};

export const timeOffSerializer = (raw: unknown): TimeOff | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const from = dayOrNull(raw.from);
  const to = dayOrNull(raw.to);
  if (!id || !from || !to) return null;
  return { id, from, to, locationId: strOrNull(raw.locationId), locationName: strOrNull(raw.locationName), reason: strOrNull(raw.reason) };
};

export const timeOffListSerializer = (raw: unknown): TimeOff[] => compact(arr(raw).map(timeOffSerializer));

/** `409 TIME_OFF_CONFLICT` details → the booked visits in the way. */
export const conflictsFrom = (details: Record<string, unknown> | null | undefined): ConflictingAppointment[] =>
  compact(
    arr(details?.appointments).map(a => {
      if (!isObject(a)) return null;
      const startAt = isoOrNull(a.startAt);
      return str(a.id) && startAt
        ? { id: str(a.id), code: str(a.code), startAt, timezone: timezone(a.timezone), patientName: str(a.patientName, 'Patient') }
        : null;
    }),
  );

const actionsSerializer = (raw: unknown): DoctorActions => {
  const r = isObject(raw) ? raw : {};
  return {
    canCheckIn: bool(r.canCheckIn),
    canStart: bool(r.canStart),
    canComplete: bool(r.canComplete),
    canNoShow: bool(r.canNoShow),
    canCancel: bool(r.canCancel),
    canConfirmPayment: bool(r.canConfirmPayment),
    canWritePrescription: bool(r.canWritePrescription),
    canJoinVideo: bool(r.canJoinVideo),
  };
};

const patientLite = (raw: unknown) => {
  const r = isObject(raw) ? raw : {};
  return { name: str(r.name, 'Patient'), age: numOrNull(r.age), gender: gender(r.gender) };
};

export const queueItemSerializer = (raw: unknown): QueueItem | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const startAt = isoOrNull(raw.startAt);
  if (!id || !startAt) return null;
  const kind = oneOf(raw.kind, KINDS, 'clinic');
  return {
    id,
    code: str(raw.code),
    startAt,
    timezone: timezone(raw.timezone),
    kind,
    status: oneOf(raw.status, APPOINTMENT_STATUSES, 'confirmed'),
    patient: patientLite(raw.patient),
    firstVisit: bool(raw.firstVisit),
    reason: strOrNull(raw.reason),
    checkedInAt: isoOrNull(raw.checkedInAt),
    paymentMethod: oneOf(raw.paymentMethod, ['pay_at_visit', 'transfer'] as const, 'pay_at_visit'),
    paymentStatus: oneOf(raw.paymentStatus, APPOINTMENT_PAYMENT_STATUSES, 'pay_at_visit'),
    locationId: str(raw.locationId),
    locationName: str(raw.locationName),
    canJoinVideo: kind === 'video' && bool(raw.canJoinVideo),
    joinOpensAt: kind === 'video' ? isoOrNull(raw.joinOpensAt) : null,
    actions: actionsSerializer(raw.actions),
  };
};

export const todaySerializer = (raw: unknown): TodaySummary | null => {
  if (!isObject(raw)) return null;
  const date = dayOrNull(raw.date);
  if (!date) return null;
  const c = isObject(raw.counts) ? raw.counts : {};
  return {
    date,
    timezone: timezone(raw.timezone),
    locations: compact(
      arr(raw.locations).map(l => (isObject(l) && str(l.id) ? { id: str(l.id), name: str(l.name), kind: oneOf(l.kind, KINDS, 'clinic') } : null)),
    ),
    counts: { booked: count(c.booked), checkedIn: count(c.checkedIn), done: count(c.done), noShow: count(c.noShow) },
    queue: compact(arr(raw.queue).map(queueItemSerializer)).sort((a, b) => a.startAt.localeCompare(b.startAt)),
  };
};

const calendarItemSerializer = (raw: unknown): CalendarItem | null => {
  if (!isObject(raw)) return null;
  const startAt = isoOrNull(raw.startAt);
  if (!str(raw.id) || !startAt) return null;
  return {
    id: str(raw.id),
    startAt,
    endAt: isoOrNull(raw.endAt) ?? startAt,
    timezone: timezone(raw.timezone),
    kind: oneOf(raw.kind, KINDS, 'clinic'),
    locationId: str(raw.locationId),
    locationName: str(raw.locationName),
    patientName: str(raw.patientName, 'Patient'),
    status: oneOf(raw.status, APPOINTMENT_STATUSES, 'confirmed'),
  };
};

export const calendarSerializer = (raw: unknown): CalendarRange => {
  const r = isObject(raw) ? raw : {};
  return {
    appointments: compact(arr(r.appointments).map(calendarItemSerializer)),
    timeOff: timeOffListSerializer(r.timeOff),
    locations: compact(
      arr(r.locations).map(l => (isObject(l) && str(l.id) ? { id: str(l.id), name: str(l.name), kind: oneOf(l.kind, KINDS, 'clinic') } : null)),
    ),
  };
};

const previousVisitSerializer = (raw: unknown): PreviousVisit | null => {
  if (!isObject(raw)) return null;
  const startAt = isoOrNull(raw.startAt);
  if (!startAt) return null;
  return {
    appointmentId: str(raw.appointmentId),
    code: str(raw.code),
    startAt,
    kind: oneOf(raw.kind, KINDS, 'clinic'),
    diagnosis: strOrNull(raw.diagnosis),
    prescriptionId: strOrNull(raw.prescriptionId),
    notes: strOrNull(raw.notes),
  };
};

export const doctorAppointmentSerializer = (raw: unknown): DoctorAppointmentDetail | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const startAt = isoOrNull(raw.startAt);
  if (!id || !startAt) return null;
  const p = isObject(raw.patient) ? raw.patient : {};
  const n = isObject(raw.notes) ? raw.notes : {};
  return {
    id,
    code: str(raw.code),
    status: oneOf(raw.status, APPOINTMENT_STATUSES, 'confirmed'),
    kind: oneOf(raw.kind, KINDS, 'clinic'),
    startAt,
    endAt: isoOrNull(raw.endAt) ?? startAt,
    timezone: timezone(raw.timezone),
    location: locationRefSerializer(raw.location),
    patient: {
      ...patientLite(p),
      id: str(p.id),
      phone: strOrNull(p.phone),
      visitsWithYou: count(p.visitsWithYou),
      noShows: count(p.noShows),
      lateCancels: count(p.lateCancels),
    },
    reasonTags: reasonTags(raw.reasonTags),
    reason: strOrNull(raw.reason),
    records: compact(arr(raw.records).map(healthRecordSerializer)),
    previousVisits: compact(arr(raw.previousVisits).map(previousVisitSerializer)),
    notes: { text: str(n.text), attachments: strings(n.attachments), updatedAt: isoOrNull(n.updatedAt) },
    payment: paymentSerializer(raw.payment),
    checkedInAt: isoOrNull(raw.checkedInAt),
    actions: actionsSerializer(raw.actions),
    prescription: raw.prescription ? prescriptionSerializer(raw.prescription) : null,
    timeline: compact(arr(raw.timeline).map(eventSerializer)),
  };
};

export const medicineSuggestionsSerializer = (raw: unknown): MedicineSuggestion[] =>
  compact(
    arr(raw).map(m =>
      isObject(m) && str(m.name)
        ? {
            name: str(m.name),
            strength: str(m.strength),
            form: oneOf(m.form, ['tablet', 'capsule', 'syrup', 'injection', 'drops', 'cream', 'inhaler', 'other'] as const, 'tablet'),
            isFavourite: bool(m.isFavourite),
          }
        : null,
    ),
  ).sort((a, b) => Number(b.isFavourite) - Number(a.isFavourite));

export const patientRowSerializer = (raw: unknown): PatientRow | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  return { id, ...patientLite(raw), lastVisitAt: iso(raw.lastVisitAt), visits: count(raw.visits) };
};

export const patientHistorySerializer = (raw: unknown): PatientHistory | null => {
  if (!isObject(raw)) return null;
  const p = isObject(raw.patient) ? raw.patient : {};
  if (!str(p.id)) return null;
  return {
    patient: { id: str(p.id), ...patientLite(p) },
    visits: compact(arr(raw.visits).map(previousVisitSerializer)).sort((a, b) => b.startAt.localeCompare(a.startAt)),
  };
};

export const insightsSerializer = (raw: unknown): DoctorInsights | null => {
  if (!isObject(raw)) return null;
  const o = isObject(raw.outcomes) ? raw.outcomes : {};
  return {
    range: oneOf(raw.range, ['7d', '30d', '90d'] as readonly DoctorInsightsRange[], '30d'),
    perDay: compact(
      arr(raw.perDay).map(d => {
        if (!isObject(d)) return null;
        const date = dayOrNull(d.date);
        return date ? { date, video: count(d.video), clinic: count(d.clinic) } : null;
      }),
    ),
    outcomes: { completed: count(o.completed), cancelled: count(o.cancelled), noShow: count(o.noShow) },
    avgWaitMinutes: numOrNull(raw.avgWaitMinutes),
    ratingTrend: compact(
      arr(raw.ratingTrend).map(d => {
        if (!isObject(d)) return null;
        const date = dayOrNull(d.date);
        const r = rating(d.rating);
        return date && r !== null ? { date, rating: r } : null;
      }),
    ),
    recordedFees: money(raw.recordedFees),
    appointments: count(raw.appointments),
  };
};
