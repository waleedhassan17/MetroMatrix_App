// ═══════════════════════════════════════════════════════
// MetroMatrix — The dummy Health API's wire shapes
// ═══════════════════════════════════════════════════════
// What MetroMatrix-API docs/API_HEALTH.md says each route answers, built
// from the dummy database (healthTypes): times in the location's zone with
// its offset, icon keys, title keys, API status names, nested `can.*`
// flags. The app's serializers read these exactly as they read the real
// API, so mock mode exercises the same code.

import type { MockAppointment, MockCondition, MockDoctor, MockDoctorReview, MockHealth, MockLocation, MockSpecialty } from './healthTypes';
import type { AppointmentEventType, ConsultKind } from '../../../../types/health';
import { PKT, addDays, ageFrom, dateInZone, formatDayShort, formatSlot, isoWeekday, todayInZone, zoneOffsetMinutes } from '../../../../utils/healthTime';
import { iconKeyForGlyph, recordTypeOut, titleKey } from '../../../../serializers/health/healthCommon';
import { reviewTagCodes } from '../../../../models/health/reviewFormModel';
import { weekdayFromAppDay } from '../../../../models/health/availabilityModel';
import {
  DAY,
  HOUR,
  JOIN_EARLY_MIN,
  JOIN_LATE_MIN,
  MINUTE,
  PRESCRIPTION_EDIT_HOURS,
  REVIEW_WINDOW_DAYS,
  canJoin,
  doctorActions,
  doctorById,
  doctorStats,
  earliestOf,
  initialsName,
  isActive,
  locationById,
  locationsOf,
  nextAvailable,
  patientFlags,
  patientKey,
  slotsFor,
  specialtyBySlug,
  visibleReviews,
} from './healthLogic';

// ─── Basics ───────────────────────────────────────────
/** A UTC instant as the API sends it: the wall time in `tz` with its offset ("…T18:30:00.000+05:00"). */
export const zoned = (iso: string | null | undefined, tz: string = PKT): string | null => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const off = zoneOffsetMinutes(tz, ms);
  const wall = new Date(ms + off * MINUTE).toISOString().slice(0, 23);
  const abs = Math.abs(off);
  return `${wall}${off >= 0 ? '+' : '-'}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
};

/** The API's icon keys ("skin", "thermometer"); a stray glyph name is turned back into its key. */
export const iconKey = (v: string | null | undefined): string | null => (v ? (v.endsWith('-outline') ? iconKeyForGlyph(v) : v) : null);

export const displayName = (d: MockDoctor) => `${d.title} ${d.name}`.trim();

const WEEKDAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const fmt12 = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  const hh = h % 24;
  return `${hh % 12 || 12}:${String(m).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
};

const tzOf = (h: MockHealth, locationId: string) => locationById(h, locationId)?.timezone ?? PKT;

/** "Ali Raza" → "Ali R." (a named review); an anonymous one shows initials. */
const shortName = (name: string) => {
  const [first, last] = name.trim().split(/\s+/);
  return last ? `${first} ${last[0].toUpperCase()}.` : first || 'Patient';
};

// ─── Reference ────────────────────────────────────────
export const specialtyRefWire = (h: MockHealth, slug: string | null) => {
  const s = specialtyBySlug(h, slug) ?? specialtyBySlug(h, 'general-physician');
  return s ? { id: s.id, name: s.name, nameUr: s.nameUr, slug: s.slug } : null;
};

/** Listed doctors with an active clinic in `city` (anywhere when no city). */
const doctorsIn = (h: MockHealth, slug: string, city: string | null) =>
  h.doctors.filter(
    d =>
      d.isListed &&
      (d.specialtySlug === slug || d.secondarySpecialtySlug === slug) &&
      (!city || locationsOf(h, d.id).some(l => l.kind === 'clinic' && l.city.toLowerCase() === city.toLowerCase())),
  ).length;

export const specialtyWire = (h: MockHealth, s: MockSpecialty, city: string | null) => ({
  id: s.id,
  name: s.name,
  nameUr: s.nameUr,
  slug: s.slug,
  icon: iconKey(s.icon),
  description: null,
  doctorCount: doctorsIn(h, s.slug, city),
});

export const conditionWire = (h: MockHealth, c: MockCondition) => ({
  id: c.id,
  name: c.name,
  nameUr: c.nameUr,
  slug: c.slug,
  isCommon: c.isCommon,
  icon: iconKey(c.icon),
  specialties: c.specialtySlug ? [specialtyRefWire(h, c.specialtySlug)].filter(Boolean) : [],
});

// ─── Doctors ──────────────────────────────────────────
/** "Available today, 6:00 PM" · "Available tomorrow from 2:00 PM" · "Next available Thu 15 Oct". */
export const availabilityLabel = (loc: MockLocation, next: { date: string; startAt: string }, now: number) => {
  const today = todayInZone(loc.timezone, now);
  const time = formatSlot(next.startAt, loc.timezone);
  if (next.date === today) return `Available today, ${time}`;
  if (next.date === addDays(today, 1)) return `Available tomorrow from ${time}`;
  return `Next available ${formatDayShort(next.date)}`;
};

const yearsOf = (d: MockDoctor, now: number) => (d.practisingSince ? Math.max(0, new Date(now).getUTCFullYear() - d.practisingSince) : null);

const pmdcVerified = (h: MockHealth, d: MockDoctor) => h.pmdc[d.businessId ?? '']?.verified !== false;

/** `DoctorCard` (§2). With `kind`, fee and availability are for that kind. */
export const cardWire = (h: MockHealth, d: MockDoctor, now: number, kind?: ConsultKind | null) => {
  const locs = locationsOf(h, d.id);
  const stats = doctorStats(h, d);
  const fees = locs.filter(l => !kind || l.kind === kind).map(l => l.fee);
  const best = earliestOf(h, d, now, kind);
  return {
    id: d.id,
    title: titleKey(d.title),
    fullName: d.name,
    displayName: displayName(d),
    photoUrl: d.photoUrl,
    gender: d.gender,
    specialty: specialtyRefWire(h, d.specialtySlug),
    qualifications: d.qualifications.map(q => q.degree).join(', '),
    yearsExperience: yearsOf(d, now),
    ratingAvg: stats.rating ?? 0,
    ratingCount: stats.reviewCount,
    satisfactionPct: stats.satisfactionPct,
    avgWaitMinutes: stats.waitMinutes,
    pmdcVerified: pmdcVerified(h, d),
    isTopBooked: d.topBooked,
    minFee: fees.length ? Math.min(...fees) : null,
    offersVideo: locs.some(l => l.kind === 'video'),
    offersClinic: locs.some(l => l.kind === 'clinic'),
    nextAvailable: best
      ? { at: zoned(best.next.startAt, best.loc.timezone), locationKind: best.loc.kind, label: availabilityLabel(best.loc, best.next, now) }
      : null,
  };
};

/** Weekly hours as `timings: [{ weekday 0–6, weekdayLabel, ranges: [{ start, end, label }] }]`. */
export const timingsWire = (loc: MockLocation) =>
  [...loc.hours]
    .filter(d => d.ranges.length)
    .sort((a, b) => a.day - b.day)
    .map(d => {
      const weekday = weekdayFromAppDay(d.day);
      return {
        weekday,
        weekdayLabel: WEEKDAY_LABEL[weekday],
        ranges: d.ranges.map(r => ({ start: r.from, end: r.to, label: `${fmt12(r.from)} – ${fmt12(r.to)}` })),
      };
    });

/** A location on the public profile. */
export const locationWire = (h: MockHealth, loc: MockLocation, now: number) => {
  const next = nextAvailable(h, loc, now);
  return {
    id: loc.id,
    kind: loc.kind,
    name: loc.name,
    addressLine: loc.kind === 'video' ? null : loc.address,
    area: loc.kind === 'video' ? null : loc.area,
    city: loc.kind === 'video' ? null : loc.city,
    lat: loc.lat,
    lng: loc.lng,
    phone: loc.phone,
    timezone: loc.timezone,
    fee: loc.fee,
    slotMinutes: loc.slotMinutes,
    instructions: loc.instructions,
    nextAvailable: next ? { at: zoned(next.startAt, loc.timezone), label: availabilityLabel(loc, next, now) } : null,
    timings: timingsWire(loc),
  };
};

/** A location in the doctor's own list. */
export const doctorLocationWire = (h: MockHealth, loc: MockLocation, now: number) => ({
  id: loc.id,
  kind: loc.kind,
  name: loc.name,
  addressLine: loc.address,
  area: loc.area || null,
  city: loc.kind === 'video' ? null : loc.city,
  lat: loc.lat,
  lng: loc.lng,
  phone: loc.phone,
  timezone: loc.timezone,
  fee: loc.fee,
  slotMinutes: loc.slotMinutes,
  instructions: loc.instructions,
  isActive: loc.isActive,
  nextAvailableAt: nextAvailable(h, loc, now)?.startAt ?? null,
});

export const scheduleWire = (loc: MockLocation) => ({
  locationId: loc.id,
  timezone: loc.timezone,
  ranges: [...loc.hours]
    .sort((a, b) => a.day - b.day)
    .flatMap(d => d.ranges.map(r => ({ weekday: weekdayFromAppDay(d.day), weekdayLabel: WEEKDAY_LABEL[weekdayFromAppDay(d.day)], start: r.from, end: r.to }))),
});

// ─── Reviews ──────────────────────────────────────────
export const reviewWire = (h: MockHealth, r: MockDoctorReview, opts: { owner?: boolean; staff?: boolean } = {}) => {
  const base: Record<string, unknown> = {
    id: r.id,
    author: r.anonymous ? initialsName(r.authorName) : shortName(r.authorName),
    isAnonymous: r.anonymous,
    verifiedVisit: true,
    kind: r.kind,
    overall: r.rating,
    diagnosis: r.dimensions.diagnosis ?? r.rating,
    staff: r.dimensions.staff ?? null,
    environment: r.kind === 'clinic' ? (r.dimensions.environment ?? null) : null,
    recommend: r.recommend,
    tags: reviewTagCodes(r.tags),
    text: r.text,
    createdAt: r.createdAt,
    reply: r.reply ? { text: r.reply.text, at: r.reply.createdAt } : null,
  };
  if (opts.owner || opts.staff) {
    const a = r.appointmentId ? h.appointments.find(x => x.id === r.appointmentId) : null;
    Object.assign(base, { appointmentCode: a?.code ?? null, hidden: r.isHidden, hiddenReason: r.hiddenReason });
  }
  if (opts.staff) {
    const d = doctorById(h, r.doctorId);
    Object.assign(base, {
      doctorId: r.doctorId,
      doctorName: d ? displayName(d) : null,
      patientUserId: r.userId,
      authorName: r.anonymous ? initialsName(r.authorName) : shortName(r.authorName),
      hiddenAt: r.isHidden ? r.createdAt : null,
    });
  }
  return base;
};

const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** `reviewSummary` (§2): averages, satisfaction, per-star counts, top tags and the latest three. */
export const summaryWire = (h: MockHealth, doctorId: string) => {
  const reviews = visibleReviews(h, doctorId);
  const distribution = [0, 0, 0, 0, 0];
  for (const r of reviews) distribution[Math.min(5, Math.max(1, r.rating)) - 1] += 1;
  const tags = new Map<string, number>();
  for (const r of reviews) for (const t of reviewTagCodes(r.tags)) tags.set(t, (tags.get(t) ?? 0) + 1);
  const dim = (k: 'diagnosis' | 'staff' | 'environment') =>
    round1(avg(reviews.map(r => r.dimensions[k] ?? (k === 'diagnosis' ? r.rating : undefined)).filter((x): x is number => typeof x === 'number')));
  return {
    count: reviews.length,
    averages: { overall: round1(avg(reviews.map(r => r.rating))), diagnosis: dim('diagnosis'), staff: dim('staff'), environment: dim('environment') },
    satisfactionPct: reviews.length >= 3 ? Math.round((reviews.filter(r => r.recommend).length / reviews.length) * 100) : null,
    distribution,
    topTags: [...tags.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([tag, count]) => ({ tag, count })),
    latest: [...reviews]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3)
      .map(r => reviewWire(h, r)),
  };
};

const patientsServed = (h: MockHealth, d: MockDoctor) =>
  new Set(h.appointments.filter(a => a.doctorId === d.id && a.status === 'completed').map(patientKey)).size;

/** `DoctorProfile` (§2). */
export const profileWire = (h: MockHealth, d: MockDoctor, now: number) => {
  const card = cardWire(h, d, now);
  const stats = doctorStats(h, d);
  const locs = [...locationsOf(h, d.id)].sort((a, b) => a.kind.localeCompare(b.kind) || a.fee - b.fee);
  return {
    ...card,
    about: d.about,
    languages: d.languages,
    pmdcNumber: d.pmdcNumber,
    badges: { pmdcVerified: card.pmdcVerified, topBooked: d.topBooked },
    stats: {
      ratingAvg: card.ratingAvg,
      ratingCount: card.ratingCount,
      satisfactionPct: stats.satisfactionPct,
      avgWaitMinutes: stats.waitMinutes,
      avgConsultMinutes: stats.timeWithPatientMinutes,
      patientsServed: patientsServed(h, d),
      yearsExperience: card.yearsExperience,
    },
    booking: {
      isAccepting: true,
      bookingWindowDays: d.bookingRules.windowDays,
      cancelCutoffMinutes: Math.round(d.bookingRules.cancelCutoffHours * 60),
      videoPrepayRequired: locs.some(l => l.kind === 'video' && l.requiresPrepay),
    },
    secondarySpecialties: d.secondarySpecialtySlug ? [specialtyBySlug(h, d.secondarySpecialtySlug)].filter(Boolean).map(s => specialtyWire(h, s!, null)) : [],
    conditions: d.conditionSlugs
      .map(slug => h.conditions.find(c => c.slug === slug))
      .filter((c): c is MockCondition => !!c)
      .map(c => ({ id: c.id, name: c.name, nameUr: c.nameUr, slug: c.slug })),
    services: d.services,
    qualificationList: d.qualifications,
    experiences: d.experience.map(e => ({ designation: e.role, institute: e.place, fromYear: e.from, toYear: e.to })),
    locations: locs.map(l => locationWire(h, l, now)),
    reviewSummary: summaryWire(h, d.id),
  };
};

/** The doctor's own `GET /health/doctor/profile`. */
export const ownProfileWire = (h: MockHealth, d: MockDoctor, now: number, pmdc: { verified: boolean; at: string | null }) => {
  const stats = doctorStats(h, d);
  const best = earliestOf(h, d, now);
  return {
    id: d.id,
    title: titleKey(d.title),
    fullName: d.name,
    gender: d.gender,
    photoUrl: d.photoUrl,
    pmdcNumber: d.pmdcNumber || `UNSET-${d.id}`,
    pmdcVerified: pmdc.verified,
    pmdcVerifiedAt: pmdc.at,
    primarySpecialty: d.specialtySlug ? specialtyRefWire(h, d.specialtySlug) : null,
    secondarySpecialtyIds: d.secondarySpecialtySlug ? [specialtyBySlug(h, d.secondarySpecialtySlug)?.id].filter(Boolean) : [],
    practicingSince: d.practisingSince,
    yearsExperience: yearsOf(d, now),
    about: d.about,
    languages: d.languages,
    bookingWindowDays: d.bookingRules.windowDays,
    minNoticeMinutes: d.bookingRules.minNoticeMinutes,
    cancelCutoffMinutes: Math.round(d.bookingRules.cancelCutoffHours * 60),
    videoPrepayRequired: d.bookingRules.videoPrepay,
    isAccepting: true,
    isListed: d.isListed,
    unlistedReason: null,
    qualifications: d.qualifications,
    experiences: d.experience.map(e => ({ designation: e.role, institute: e.place, fromYear: e.from, toYear: e.to })),
    services: d.services,
    conditions: d.conditionSlugs
      .map(slug => h.conditions.find(c => c.slug === slug))
      .filter((c): c is MockCondition => !!c)
      .map(c => ({ id: c.id, name: c.name, slug: c.slug })),
    stats: {
      ratingAvg: stats.rating ?? 0,
      ratingCount: stats.reviewCount,
      satisfactionPct: stats.satisfactionPct,
      avgWaitMinutes: stats.waitMinutes,
      avgConsultMinutes: stats.timeWithPatientMinutes,
      patientsServed: patientsServed(h, d),
    },
    nextAvailableAt: best?.next.startAt ?? null,
  };
};

/** `{ percent, missing, isListed }`: the API's checklist keys, in its order. */
export const completenessWire = (h: MockHealth, d: MockDoctor, pmdcOk: boolean) => {
  const locs = locationsOf(h, d.id);
  const checks: [string, boolean][] = [
    ['pmdc_verified', pmdcOk],
    ['name', d.name.trim().length >= 3],
    ['gender', !!d.gender],
    ['photo', !!d.photoUrl],
    ['primary_specialty', !!d.specialtySlug],
    ['practicing_since', !!d.practisingSince],
    ['about', d.about.trim().length >= 40],
    ['languages', d.languages.length > 0],
    ['qualifications', d.qualifications.length > 0],
    ['active_location', locs.length > 0],
    ['weekly_schedule', locs.some(l => l.hours.some(x => x.ranges.length))],
  ];
  const missing = checks.filter(([, ok]) => !ok).map(([k]) => k);
  return { percent: Math.round(((checks.length - missing.length) / checks.length) * 100), missing, isListed: d.isListed };
};

// ─── Slots ────────────────────────────────────────────
/** `Slots` (§2): `days` days from `from` in the location's zone. */
export const slotsWire = (h: MockHealth, loc: MockLocation, from: string, days: number, now: number) => ({
  doctorId: loc.doctorId,
  location: { id: loc.id, kind: loc.kind, name: loc.name, area: loc.area || null, city: loc.kind === 'video' ? null : loc.city, timezone: loc.timezone, fee: loc.fee, slotMinutes: loc.slotMinutes },
  days: Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    const weekday = weekdayFromAppDay(isoWeekday(date));
    const slots = slotsFor(h, loc, date, now);
    return {
      date,
      weekday,
      weekdayLabel: WEEKDAY_LABEL[weekday],
      dateLabel: formatDayShort(date),
      isAvailable: slots.length > 0,
      slots: slots.map(s => ({
        startsAt: zoned(s.startAt, loc.timezone),
        endsAt: zoned(new Date(Date.parse(s.startAt) + loc.slotMinutes * MINUTE).toISOString(), loc.timezone),
        period: s.period,
      })),
    };
  }),
});

// ─── Appointments ─────────────────────────────────────
/** The app's statuses (the dummy database keeps them) → the API's. */
const STATUS_OUT: Record<MockAppointment['status'], string> = {
  awaiting_payment: 'booked',
  confirmed: 'booked',
  checked_in: 'checked_in',
  in_progress: 'in_consultation',
  completed: 'completed',
  cancelled: 'cancelled',
  no_show: 'no_show',
};

const PAYMENT_OUT: Record<MockAppointment['paymentStatus'], string> = {
  pay_at_visit: 'unpaid',
  awaiting_transfer: 'awaiting_transfer',
  proof_submitted: 'proof_submitted',
  proof_rejected: 'awaiting_transfer',
  paid: 'paid',
  collected: 'paid',
  void: 'void',
  refund_due: 'refund_due',
  refunded: 'refunded',
};

const eventAt = (a: MockAppointment, type: AppointmentEventType) => [...a.events].reverse().find(e => e.type === type)?.createdAt ?? null;

const paymentWire = (a: MockAppointment, tz: string) => ({
  method: a.paymentMethod === 'transfer' ? 'transfer' : 'pay_at_clinic',
  status: PAYMENT_OUT[a.paymentStatus],
  // A deadline only for prepaid video (the visit is held until the transfer arrives).
  payBy: a.status === 'awaiting_payment' && a.instructions ? zoned(a.instructions.payBy, tz) : null,
  paidAt: zoned(a.paymentStatus === 'collected' ? a.completedAt : eventAt(a, 'payment_confirmed'), tz),
  paymentRef: a.proof?.transactionId ?? null,
  proofUrl: a.proof?.imageUrl ?? null,
  rejectedReason: a.paymentStatus === 'proof_rejected' ? (a.proof?.rejectionReason ?? null) : null,
  accounts: a.instructions
    ? [{ kind: a.instructions.kind, bankName: a.instructions.bankName, accountTitle: a.instructions.accountTitle, accountNumber: a.instructions.accountNumber }]
    : null,
  refundRef: null,
  refundedAt: zoned(eventAt(a, 'refunded'), tz),
});

/** The core every appointment view shares (§2). */
const coreWire = (h: MockHealth, a: MockAppointment, now: number) => {
  const tz = tzOf(h, a.locationId);
  const member = a.familyMemberId ? h.family.find(f => f.id === a.familyMemberId) : null;
  return {
    id: a.id,
    code: a.code,
    status: STATUS_OUT[a.status],
    kind: a.kind,
    startsAt: zoned(a.startAt, tz),
    endsAt: zoned(a.endAt, tz),
    patient: { name: a.patientName, gender: a.patientGender, age: ageFrom(a.patientDob, now), phone: a.patientPhone, relation: member?.relation ?? null },
    familyMemberId: a.familyMemberId,
    reason: a.reason,
    symptoms: a.reasonTags,
    fee: a.fee,
    payment: paymentWire(a, tz),
    lateCancel: a.lateCancel,
    cancelledBy: a.cancelledBy,
    cancelReason: a.cancelReason,
    rescheduledFromId: a.rescheduledFromId ?? null,
    bookedAt: zoned(a.createdAt, tz),
    checkedInAt: zoned(a.checkedInAt, tz),
    startedAt: zoned(a.startedAt, tz),
    completedAt: zoned(a.completedAt, tz),
    cancelledAt: zoned(eventAt(a, 'cancelled'), tz),
  };
};

const STATUS_EVENTS: Partial<Record<AppointmentEventType, string>> = {
  booked: 'booked',
  rescheduled: 'booked',
  checked_in: 'checked_in',
  in_progress: 'in_consultation',
  completed: 'completed',
  cancelled: 'cancelled',
  no_show: 'no_show',
};
const PAYMENT_EVENTS: Partial<Record<AppointmentEventType, [string | null, string]>> = {
  payment_proof_submitted: ['awaiting_transfer', 'proof_submitted'],
  payment_confirmed: ['proof_submitted', 'paid'],
  payment_rejected: ['proof_submitted', 'awaiting_transfer'],
  refund_due: ['paid', 'refund_due'],
  refunded: ['refund_due', 'refunded'],
};
const ACTOR: Partial<Record<AppointmentEventType, string>> = {
  booked: 'patient',
  rescheduled: 'patient',
  payment_proof_submitted: 'patient',
};

/** The timeline `{ kind, from, to, actorRole, note, at }`; the app's own "confirmed" and "prescription" rows aren't API events. */
const eventsWire = (a: MockAppointment, tz: string) =>
  a.events
    .map(e => {
      const at = zoned(e.createdAt, tz);
      const actorRole = e.type === 'cancelled' ? (a.cancelledBy ?? 'patient') : (ACTOR[e.type] ?? 'doctor');
      if (STATUS_EVENTS[e.type]) {
        return { kind: 'status', from: null, to: STATUS_EVENTS[e.type], actorRole, note: e.type === 'rescheduled' ? 'Rescheduled' : e.note, at };
      }
      const pay = PAYMENT_EVENTS[e.type];
      return pay ? { kind: 'payment', from: pay[0], to: pay[1], actorRole, note: e.note, at } : null;
    })
    .filter(Boolean);

/** What a visit shows of the records shared with it (metadata; the files come when a doctor opens one). */
const sharedRecordsWire = (h: MockHealth, a: MockAppointment, tz: string) =>
  a.recordIds
    .map(id => h.records.find(r => r.id === id))
    .filter((r): r is MockHealth['records'][number] => !!r)
    .map(r => ({
      id: r.id,
      title: r.title,
      type: recordTypeOut(r.type),
      recordDate: r.recordedOn,
      notes: null,
      fileCount: r.files.length,
      mimes: [...new Set(r.files.map(f => f.mime))],
      sharedAt: zoned(a.createdAt, tz),
    }));

/** `PatientAppointment` (§2); `detail` adds events and shared records. */
export const patientAppointmentWire = (h: MockHealth, a: MockAppointment, now: number, detail = false) => {
  const tz = tzOf(h, a.locationId);
  const d = doctorById(h, a.doctorId);
  const l = locationById(h, a.locationId);
  const flags = patientFlags(h, a, now);
  const cutoff = Date.parse(a.startAt) - (d?.bookingRules.cancelCutoffHours ?? 4) * HOUR;
  return {
    ...coreWire(h, a, now),
    doctor: { id: a.doctorId, displayName: d ? displayName(d) : 'Doctor', photoUrl: d?.photoUrl ?? null, specialty: specialtyBySlug(h, d?.specialtySlug ?? null)?.name ?? null },
    location: {
      id: a.locationId,
      kind: a.kind,
      name: l?.name ?? (a.kind === 'video' ? 'Video consultation' : 'Clinic'),
      addressLine: a.kind === 'video' ? null : (l?.address ?? null),
      area: a.kind === 'video' ? null : (l?.area ?? null),
      city: a.kind === 'video' ? null : (l?.city ?? null),
      lat: l?.lat ?? null,
      lng: l?.lng ?? null,
      phone: l?.phone ?? null,
      instructions: l?.instructions ?? null,
      timezone: tz,
    },
    cancelCutoffAt: zoned(new Date(cutoff).toISOString(), tz),
    prescriptionId: a.prescriptionId,
    reviewed: !!a.reviewId,
    ...(detail ? { events: eventsWire(a, tz), sharedRecords: sharedRecordsWire(h, a, tz) } : {}),
    can: {
      cancel: flags.canCancel,
      reschedule: flags.canReschedule,
      joinVideo: flags.canJoinVideo,
      shareRecords: flags.canAttachRecords,
      submitPaymentProof: flags.canPay,
      review: flags.canReview,
    },
  };
};

/** The staff view (§4.4): booking facts and the trail with who acted; never notes, records or the prescription itself. */
export const adminAppointmentWire = (h: MockHealth, a: MockAppointment, now: number) => {
  const tz = tzOf(h, a.locationId);
  const d = doctorById(h, a.doctorId);
  const l = locationById(h, a.locationId);
  return {
    ...coreWire(h, a, now),
    patientUserId: a.userId,
    doctor: { id: a.doctorId, businessId: d?.businessId ?? null, displayName: d ? displayName(d) : 'Doctor', specialty: specialtyBySlug(h, d?.specialtySlug ?? null)?.name ?? null },
    hasPrescription: !!a.prescriptionId,
    location: { id: a.locationId, kind: a.kind, name: l?.name ?? 'Clinic', city: a.kind === 'video' ? null : (l?.city ?? null), timezone: tz },
    events: eventsWire(a, tz).map(e => ({
      ...e!,
      actorUserId: e!.actorRole === 'patient' ? a.userId : e!.actorRole === 'doctor' ? (d?.ownerId ?? null) : null,
    })),
  };
};

const firstVisit = (h: MockHealth, a: MockAppointment) =>
  !h.appointments.some(o => o.id !== a.id && o.doctorId === a.doctorId && patientKey(o) === patientKey(a) && o.status === 'completed' && o.startAt < a.startAt);

/** Prescriptions can be written from the start of the consultation until 24 hours after completion. */
export const prescriptionOpen = (a: MockAppointment, now: number) =>
  a.status === 'in_progress' || (a.status === 'completed' && !!a.completedAt && now - Date.parse(a.completedAt) <= PRESCRIPTION_EDIT_HOURS * HOUR);

/** `DoctorAppointment` (§2); `detail` adds events, history with this doctor and shared records. */
export const doctorAppointmentWire = (h: MockHealth, a: MockAppointment, now: number, detail = false) => {
  const tz = tzOf(h, a.locationId);
  const l = locationById(h, a.locationId);
  const mine = h.appointments.filter(o => o.doctorId === a.doctorId && patientKey(o) === patientKey(a));
  const actions = doctorActions(h, a, now);
  const transfer = a.paymentMethod === 'transfer';
  const waiting = a.status === 'checked_in' && a.checkedInAt ? Math.max(0, Math.floor((now - Math.max(Date.parse(a.checkedInAt), Date.parse(a.startAt))) / MINUTE)) : null;
  return {
    ...coreWire(h, a, now),
    patientKey: patientKey(a),
    location: { id: a.locationId, kind: a.kind, name: l?.name ?? 'Clinic', area: l?.area || null, timezone: tz },
    waitingMinutes: waiting,
    flags: {
      firstVisit: firstVisit(h, a),
      lateCancels: mine.filter(o => o.status === 'cancelled' && o.lateCancel).length,
      noShows: mine.filter(o => o.status === 'no_show').length,
    },
    can: {
      checkIn: actions.canCheckIn,
      start: actions.canStart,
      complete: actions.canComplete,
      noShow: actions.canNoShow,
      cancel: actions.canCancel,
      writePrescription: prescriptionOpen(a, now),
      joinVideo: actions.canJoinVideo,
      confirmPayment: transfer && (a.paymentStatus === 'awaiting_transfer' || a.paymentStatus === 'proof_submitted' || a.paymentStatus === 'proof_rejected'),
      rejectPayment: a.paymentStatus === 'proof_submitted',
      refund: a.paymentStatus === 'refund_due',
    },
    ...(detail
      ? {
          events: eventsWire(a, tz),
          history: {
            previousAppointments: mine
              .filter(o => o.id !== a.id && o.userId !== 'u_standin_ghost')
              .sort((x, y) => y.startAt.localeCompare(x.startAt))
              .map(o => ({ code: o.code, startsAt: zoned(o.startAt, tzOf(h, o.locationId)), status: STATUS_OUT[o.status], kind: o.kind, reason: o.reason })),
            prescriptions: mine
              .filter(o => o.prescriptionId)
              .map(o => {
                const p = h.prescriptions.find(x => x.id === o.prescriptionId)!;
                return { id: p.id, issuedAt: p.issuedAt, diagnosis: p.diagnosis, appointmentCode: o.code };
              }),
          },
          sharedRecords: sharedRecordsWire(h, a, tz),
        }
      : {}),
  };
};

export const notesWire = (a: MockAppointment) => ({
  appointmentCode: a.code,
  text: a.notes.text,
  files: a.notes.attachments.map(url => ({ url, publicId: url, mime: /\.pdf$/i.test(url) ? 'application/pdf' : 'image/jpeg' })),
  updatedAt: a.notes.updatedAt,
});

/** `Prescription` (§2). */
export const prescriptionWire = (h: MockHealth, p: MockHealth['prescriptions'][number], now: number) => {
  const a = h.appointments.find(x => x.id === p.appointmentId)!;
  const d = doctorById(h, p.doctorId);
  const l = a ? locationById(h, a.locationId) : null;
  const tz = l?.timezone ?? PKT;
  const member = a?.familyMemberId ? h.family.find(f => f.id === a.familyMemberId) : null;
  const editableUntil = a?.completedAt ? new Date(Date.parse(a.completedAt) + PRESCRIPTION_EDIT_HOURS * HOUR).toISOString() : null;
  return {
    id: p.id,
    appointmentCode: a?.code ?? '',
    appointmentKind: a?.kind ?? 'clinic',
    visitDate: a ? dateInZone(a.startAt, tz) : null,
    issuedAt: p.issuedAt,
    updatedAt: p.issuedAt,
    editableUntil: zoned(editableUntil, tz),
    locked: a ? !prescriptionOpen(a, now) : true,
    doctor: {
      id: p.doctorId,
      displayName: d ? displayName(d) : 'Doctor',
      qualifications: d ? d.qualifications.map(q => q.degree).join(', ') : '',
      pmdcNumber: d?.pmdcNumber ?? '',
      specialty: specialtyBySlug(h, d?.specialtySlug ?? null)?.name ?? null,
      photoUrl: d?.photoUrl ?? null,
    },
    location: l
      ? { id: l.id, kind: l.kind, name: l.name, addressLine: l.kind === 'video' ? null : l.address, area: l.kind === 'video' ? null : l.area, city: l.kind === 'video' ? null : l.city, phone: l.phone }
      : null,
    patient: a
      ? { name: a.patientName, gender: a.patientGender, age: ageFrom(a.patientDob, Date.parse(p.issuedAt)), phone: a.patientPhone, relation: member?.relation ?? null }
      : null,
    familyMemberId: a?.familyMemberId ?? null,
    diagnosis: p.diagnosis,
    advice: p.advice,
    followUpInDays: p.followUpInDays,
    followUpOn: p.followUpInDays && a ? addDays(dateInZone(a.startAt, tz), p.followUpInDays) : null,
    medicines: p.medicines.map(m => ({
      name: m.name,
      strength: m.strength || null,
      form: m.form,
      dosePattern: m.dose,
      timing: m.timing,
      durationDays: m.days,
      instructions: m.instructions,
    })),
    tests: p.tests.map(name => ({ name, instructions: null })),
  };
};

// ─── Family and records ───────────────────────────────
export const familyWire = (m: MockHealth['family'][number], now: number) => ({
  id: m.id,
  fullName: m.name,
  relation: m.relation,
  gender: m.gender,
  dateOfBirth: m.dateOfBirth || null,
  age: ageFrom(m.dateOfBirth || null, now),
  phone: m.phone,
  createdAt: null,
});

/** `HealthRecord` (§2): the owner's view, with short-lived download links (here: the file itself). */
export const recordWire = (h: MockHealth, r: MockHealth['records'][number], now: number) => ({
  id: r.id,
  title: r.title,
  type: recordTypeOut(r.type),
  recordDate: r.recordedOn,
  notes: null,
  familyMemberId: r.memberId,
  files: r.files.map((f, i) => ({
    url: f.url,
    publicId: `mock/${r.id}/${i}`,
    mime: f.mime,
    downloadUrl: f.url,
    expiresAt: new Date(now + 10 * MINUTE).toISOString(),
  })),
  sharedWith: h.appointments.filter(a => a.recordIds.includes(r.id) && isActive(a)).map(a => a.code),
  createdAt: r.createdAt,
  updatedAt: r.createdAt,
});

// ─── Video ────────────────────────────────────────────
/** docs/VIDEO.md: the window opens 10 minutes before and closes 30 after the end. */
export const videoWindow = (a: MockAppointment) => ({
  opensAt: new Date(Date.parse(a.startAt) - JOIN_EARLY_MIN * MINUTE).toISOString(),
  closesAt: new Date(Date.parse(a.endAt) + JOIN_LATE_MIN * MINUTE).toISOString(),
});

export const videoJoinWire = (a: MockAppointment, roomUrl: string, displayName: string, moderator: boolean) => ({
  appointmentCode: a.code,
  window: videoWindow(a),
  provider: 'public_jitsi',
  domain: 'meet.jit.si',
  roomName: roomUrl.split('#')[0].replace('https://meet.jit.si/', ''),
  roomUrl,
  jwt: null,
  expiresAt: videoWindow(a).closesAt,
  displayName,
  moderator,
});

/** Can the patient still review it (completed, within 30 days, not yet)? */
export const reviewOpen = (a: MockAppointment, now: number) =>
  a.status === 'completed' && !a.reviewId && now - Date.parse(a.completedAt ?? a.endAt) <= REVIEW_WINDOW_DAYS * DAY;

export { canJoin };
