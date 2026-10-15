// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Health rules and views
// ═══════════════════════════════════════════════════════
// The server rules docs/API_HEALTH_ASSUMED.md promises, so the app's
// behaviour against the dummy API is the behaviour it will have for real:
// slots come from weekly hours, slot length, bookings, time off, the booking
// window and minimum notice; a transfer has a deadline; the join window
// opens 10 minutes before; a prescription locks after 24 hours. Every
// action flag the app shows is computed here, never on the device.

import type { MockDb } from '../mockDb';
import { ShopError } from '../shop/shopLogic';
import type { MockAppointment, MockDoctor, MockDoctorReview, MockHealth, MockLocation } from './healthTypes';
import type { AppointmentStatus, ConsultKind, ReviewDimension, SlotPeriod, WeekDayHours } from '../../../../types/health';
import {
  PKT,
  addDays,
  ageFrom,
  dateInZone,
  formatDayShort,
  formatSlot,
  hourOfDay,
  isoWeekday,
  todayInZone,
  zonedToIso,
} from '../../../../utils/healthTime';

export { ShopError as HealthError };

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Video opens this long before the start, and stays open this long after the end. */
export const JOIN_EARLY_MIN = 10;
export const JOIN_LATE_MIN = 30;
/** A transfer must arrive by the sooner of this long after booking or 15 minutes before the start. */
export const PAY_WINDOW_MIN = 180;
export const PRESCRIPTION_EDIT_HOURS = 24;
export const REPLY_EDIT_HOURS = 24;
export const REVIEW_WINDOW_DAYS = 30;

export const ACTIVE: AppointmentStatus[] = ['awaiting_payment', 'confirmed', 'checked_in', 'in_progress'];
export const isActive = (a: MockAppointment) => ACTIVE.includes(a.status);

export const isoNow = (now: number = Date.now()) => new Date(now).toISOString();

export const nextId = (h: MockHealth, prefix: string) => `${prefix}_${(h.seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const appointmentCode = (h: MockHealth) => {
  for (;;) {
    let c = 'HC-';
    for (let i = 0; i < 6; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!h.appointments.some(a => a.code === c)) return c;
  }
};

export const rupees = (n: number) => `Rs ${Math.round(n).toLocaleString('en-US')}`;

// ─── Lookups ──────────────────────────────────────────
export const doctorById = (h: MockHealth, id: string) => h.doctors.find(d => d.id === id) ?? null;
export const doctorOfOwner = (h: MockHealth, userId: string) => h.doctors.find(d => d.ownerId === userId) ?? null;
export const locationById = (h: MockHealth, id: string) => h.locations.find(l => l.id === id) ?? null;
export const locationsOf = (h: MockHealth, doctorId: string) => h.locations.filter(l => l.doctorId === doctorId && l.isActive);
export const specialtyBySlug = (h: MockHealth, slug: string | null) => (slug ? (h.specialties.find(s => s.slug === slug) ?? null) : null);

export const specialtyRef = (h: MockHealth, slug: string | null) => {
  const s = specialtyBySlug(h, slug) ?? specialtyBySlug(h, 'general-physician');
  return { slug: s?.slug ?? '', name: s?.name ?? 'General physician', nameUr: s?.nameUr ?? '' };
};

// ─── Slots ────────────────────────────────────────────
const periodOf = (iso: string, timezone: string): SlotPeriod => {
  const h = hourOfDay(iso, timezone);
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
};

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export const isOff = (h: MockHealth, doctorId: string, locationId: string, date: string) =>
  h.timeOff.some(t => t.doctorId === doctorId && (!t.locationId || t.locationId === locationId) && t.from <= date && date <= t.to);

/** Does the doctor already have someone at [start, end)? (Anywhere: a doctor is in one place at a time.) */
export const doctorBusy = (h: MockHealth, doctorId: string, start: number, end: number, ignoreId?: string) =>
  h.appointments.some(
    a => a.doctorId === doctorId && a.id !== ignoreId && isActive(a) && Date.parse(a.startAt) < end && start < Date.parse(a.endAt),
  );

/** Every start in the location's weekly hours on `date`, before any rule removes one. */
const rawStarts = (loc: MockLocation, date: string): string[] => {
  const day = loc.hours.find(x => x.day === isoWeekday(date));
  const out: string[] = [];
  for (const r of day?.ranges ?? []) {
    for (let m = toMin(r.from); m + loc.slotMinutes <= toMin(r.to); m += loc.slotMinutes) out.push(zonedToIso(date, hhmm(m), loc.timezone));
  }
  return out;
};

/** The free slots at `loc` on `date` (YYYY-MM-DD in the location's zone). */
export const slotsFor = (h: MockHealth, loc: MockLocation, date: string, now: number, ignoreId?: string) => {
  const doctor = doctorById(h, loc.doctorId);
  if (!doctor || !loc.isActive) return [];
  const rules = doctor.bookingRules;
  const today = todayInZone(loc.timezone, now);
  if (date < today || date > addDays(today, rules.windowDays - 1) || isOff(h, doctor.id, loc.id, date)) return [];
  const earliest = now + rules.minNoticeMinutes * MINUTE;
  return rawStarts(loc, date)
    .filter(iso => {
      const start = Date.parse(iso);
      if (start < earliest) return false;
      return !doctorBusy(h, doctor.id, start, start + loc.slotMinutes * MINUTE, ignoreId);
    })
    .map(startAt => ({ startAt, period: periodOf(startAt, loc.timezone) }));
};

/** The first free slot from `fromDate` on, within the booking window. */
export const nextAvailable = (h: MockHealth, loc: MockLocation, now: number, fromDate?: string, ignoreId?: string) => {
  const doctor = doctorById(h, loc.doctorId);
  if (!doctor) return null;
  const today = todayInZone(loc.timezone, now);
  let date = fromDate && fromDate > today ? fromDate : today;
  const last = addDays(today, doctor.bookingRules.windowDays - 1);
  while (date <= last) {
    const slots = slotsFor(h, loc, date, now, ignoreId);
    if (slots.length) return { date, startAt: slots[0].startAt };
    date = addDays(date, 1);
  }
  return null;
};

/** Up to `n` free slots at or after `afterIso` (SLOT_TAKEN alternatives). */
export const alternativesAfter = (h: MockHealth, loc: MockLocation, afterIso: string, now: number, n = 3, ignoreId?: string) => {
  const out: { startAt: string; period: SlotPeriod }[] = [];
  const doctor = doctorById(h, loc.doctorId);
  if (!doctor) return out;
  const today = todayInZone(loc.timezone, now);
  let date = dateInZone(afterIso, loc.timezone);
  if (date < today) date = today;
  const last = addDays(today, doctor.bookingRules.windowDays - 1);
  while (date <= last && out.length < n) {
    for (const s of slotsFor(h, loc, date, now, ignoreId)) {
      if (s.startAt > afterIso && out.length < n) out.push(s);
    }
    date = addDays(date, 1);
  }
  return out;
};

/** "Available today, 6:00 PM" · "Available tomorrow, 2:00 PM" · "Available Fri 17 Oct, 5:00 PM". */
export const availabilityOf = (loc: MockLocation, next: { date: string; startAt: string } | null, now: number) => {
  if (!next) return { label: 'No times in the next two weeks', today: false, nextAt: null };
  const today = todayInZone(loc.timezone, now);
  const time = formatSlot(next.startAt, loc.timezone);
  const label =
    next.date === today
      ? `Available today, ${time}`
      : next.date === addDays(today, 1)
        ? `Available tomorrow, ${time}`
        : `Available ${formatDayShort(next.date)}, ${time}`;
  return { label, today: next.date === today, nextAt: next.startAt };
};

const DAY_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const fmt12 = (hm: string) => {
  const m = toMin(hm);
  const h = Math.floor(m / 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/** Weekly hours worded for patients, days with the same hours grouped: "Mon, Wed, Fri" · "5:00 PM – 9:00 PM". */
export const timingsOf = (hours: WeekDayHours[]) => {
  const groups: { days: number[]; hours: string }[] = [];
  for (const d of [...hours].sort((a, b) => a.day - b.day)) {
    if (!d.ranges.length) continue;
    const text = d.ranges.map(r => `${fmt12(r.from)} – ${fmt12(r.to)}`).join(', ');
    const g = groups.find(x => x.hours === text);
    if (g) g.days.push(d.day);
    else groups.push({ days: [d.day], hours: text });
  }
  return groups.map(g => {
    const consecutive = g.days.length > 2 && g.days.every((d, i) => i === 0 || d === g.days[i - 1] + 1);
    return {
      days: consecutive ? `${DAY_SHORT[g.days[0]]} – ${DAY_SHORT[g.days[g.days.length - 1]]}` : g.days.map(d => DAY_SHORT[d]).join(', '),
      hours: g.hours,
    };
  });
};

// ─── Views (wire shapes) ──────────────────────────────
export const locationView = (h: MockHealth, loc: MockLocation, now: number) => ({
  id: loc.id,
  kind: loc.kind,
  name: loc.name,
  area: loc.area,
  city: loc.city,
  address: loc.address,
  lat: loc.lat,
  lng: loc.lng,
  phone: loc.phone,
  fee: loc.fee,
  slotMinutes: loc.slotMinutes,
  instructions: loc.instructions,
  timezone: loc.timezone,
  availability: availabilityOf(loc, nextAvailable(h, loc, now), now),
  timings: timingsOf(loc.hours),
  requiresPrepay: loc.kind === 'video' && loc.requiresPrepay,
});

export const doctorLocationView = (h: MockHealth, loc: MockLocation, now: number) => ({ ...locationView(h, loc, now), hours: loc.hours });

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

export const visibleReviews = (h: MockHealth, doctorId: string) => h.reviews.filter(r => r.doctorId === doctorId && !r.isHidden);

/** Honest numbers: averages only from at least three data points. */
export const doctorStats = (h: MockHealth, d: MockDoctor) => {
  const reviews = visibleReviews(h, d.id);
  const waits = reviews.map(r => r.waitMinutes).filter((w): w is number => w !== null);
  const consults = h.appointments
    .filter(a => a.doctorId === d.id && a.status === 'completed' && a.startedAt && a.completedAt)
    .map(a => (Date.parse(a.completedAt!) - Date.parse(a.startedAt!)) / MINUTE);
  return {
    rating: reviews.length ? round1(avg(reviews.map(r => r.rating))) : null,
    reviewCount: reviews.length,
    satisfactionPct: reviews.length >= 3 ? Math.round((reviews.filter(r => r.recommend).length / reviews.length) * 100) : null,
    waitMinutes: waits.length >= 3 ? Math.max(1, Math.round(avg(waits)!)) : null,
    timeWithPatientMinutes: consults.length >= 3 ? Math.round(avg(consults)!) : null,
  };
};

const DIMENSION_LABEL: Record<ReviewDimension, string> = { diagnosis: 'Diagnosis', staff: 'Staff', environment: 'Clinic environment' };

export const reviewSummaryView = (h: MockHealth, doctorId: string) => {
  const reviews = visibleReviews(h, doctorId);
  const distribution = [0, 0, 0, 0, 0];
  for (const r of reviews) distribution[Math.min(5, Math.max(1, r.rating)) - 1] += 1;
  const tagCounts = new Map<string, number>();
  for (const r of reviews) for (const t of r.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  return {
    average: reviews.length ? round1(avg(reviews.map(r => r.rating))) : null,
    count: reviews.length,
    recommendPct: reviews.length >= 3 ? Math.round((reviews.filter(r => r.recommend).length / reviews.length) * 100) : null,
    distribution,
    dimensions: (Object.keys(DIMENSION_LABEL) as ReviewDimension[])
      .map(key => {
        const scores = reviews.map(r => r.dimensions[key]).filter((x): x is number => typeof x === 'number');
        return { key, label: DIMENSION_LABEL[key], score: scores.length >= 3 ? round1(avg(scores)) : null };
      })
      .filter(d => d.score !== null),
    tags: [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, count]) => ({ label, count })),
  };
};

export const reviewView = (r: MockDoctorReview, now: number, forOwner = false) => ({
  id: r.id,
  authorName: r.anonymous ? initialsName(r.authorName) : r.authorName,
  rating: r.rating,
  kind: r.kind,
  tags: r.tags,
  text: r.text,
  recommend: r.recommend,
  createdAt: r.createdAt,
  reply: r.reply,
  isHidden: r.isHidden,
  replyEditableUntil:
    forOwner && r.reply && now < Date.parse(r.reply.createdAt) + REPLY_EDIT_HOURS * HOUR
      ? new Date(Date.parse(r.reply.createdAt) + REPLY_EDIT_HOURS * HOUR).toISOString()
      : null,
});

/** "Ayesha Khan" → "A. K." (an anonymous review). */
export const initialsName = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => `${p[0].toUpperCase()}.`)
    .join(' ') || 'Verified patient';

const qualificationLine = (d: MockDoctor) => d.qualifications.map(q => q.degree).join(', ');
const years = (d: MockDoctor, now: number) => (d.practisingSince ? Math.max(0, new Date(now).getUTCFullYear() - d.practisingSince) : 0);

/** The earliest next slot across the doctor's locations (optionally of one kind). */
export const earliestOf = (h: MockHealth, d: MockDoctor, now: number, kind?: ConsultKind | null) => {
  let best: { loc: MockLocation; next: { date: string; startAt: string } } | null = null;
  for (const loc of locationsOf(h, d.id)) {
    if (kind && loc.kind !== kind) continue;
    const next = nextAvailable(h, loc, now);
    if (next && (!best || next.startAt < best.next.startAt)) best = { loc, next };
  }
  return best;
};

export const doctorCardView = (h: MockHealth, d: MockDoctor, now: number, kind?: ConsultKind | null) => {
  const locs = locationsOf(h, d.id);
  const stats = doctorStats(h, d);
  const fees = locs.filter(l => !kind || l.kind === kind).map(l => l.fee);
  const best = earliestOf(h, d, now, kind);
  const badges = [h.pmdc[d.businessId ?? '']?.verified !== false ? 'pmdc_verified' : null, d.topBooked ? 'top_booked' : null].filter(Boolean);
  return {
    id: d.id,
    name: `${d.title} ${d.name}`.trim(),
    photoUrl: d.photoUrl,
    gender: d.gender,
    specialty: specialtyRef(h, d.specialtySlug),
    qualifications: qualificationLine(d),
    yearsExperience: years(d, now),
    rating: stats.rating,
    reviewCount: stats.reviewCount,
    waitMinutes: stats.waitMinutes,
    badges,
    offersVideo: locs.some(l => l.kind === 'video'),
    offersClinic: locs.some(l => l.kind === 'clinic'),
    fromFee: fees.length ? Math.min(...fees) : 0,
    availability: best ? availabilityOf(best.loc, best.next, now) : { label: 'No times in the next two weeks', today: false, nextAt: null },
    city: d.city,
  };
};

export const doctorProfileView = (h: MockHealth, d: MockDoctor, now: number) => {
  const card = doctorCardView(h, d, now);
  const stats = doctorStats(h, d);
  const locs = locationsOf(h, d.id);
  const similar = h.doctors
    .filter(o => o.id !== d.id && o.isListed && o.specialtySlug === d.specialtySlug)
    .sort((a, b) => (a.city === d.city ? 0 : 1) - (b.city === d.city ? 0 : 1))
    .slice(0, 6)
    .map(o => doctorCardView(h, o, now));
  return {
    ...card,
    title: d.title,
    about: d.about,
    languages: d.languages,
    services: d.services,
    conditions: d.conditionSlugs
      .map(slug => h.conditions.find(c => c.slug === slug))
      .filter(Boolean)
      .map(c => ({ slug: c!.slug, name: c!.name })),
    qualificationList: d.qualifications,
    experienceList: d.experience,
    locations: [...locs.filter(l => l.kind === 'video'), ...locs.filter(l => l.kind === 'clinic')].map(l => locationView(h, l, now)),
    stats: {
      satisfactionPct: stats.satisfactionPct,
      waitMinutes: stats.waitMinutes,
      timeWithPatientMinutes: stats.timeWithPatientMinutes,
      reviewCount: stats.reviewCount,
    },
    reviewSummary: reviewSummaryView(h, d.id),
    topReviews: visibleReviews(h, d.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3)
      .map(r => reviewView(r, now)),
    similar,
    bookingRules: d.bookingRules,
  };
};

export const specialtyView = (h: MockHealth, slug: string, city: string | null) => {
  const s = specialtyBySlug(h, slug)!;
  const doctorCount = h.doctors.filter(
    d =>
      d.isListed &&
      (d.specialtySlug === slug || d.secondarySpecialtySlug === slug) &&
      (!city || servesCity(h, d, city)),
  ).length;
  return { id: s.id, slug: s.slug, name: s.name, nameUr: s.nameUr, icon: s.icon, doctorCount };
};

/** A doctor serves a city with a clinic there, or anywhere by video. */
export const servesCity = (h: MockHealth, d: MockDoctor, city: string) =>
  locationsOf(h, d.id).some(l => l.kind === 'video' || l.city.toLowerCase() === city.toLowerCase());

// ─── Appointments ─────────────────────────────────────
export const settleAppointments = (db: MockDb, now: number) => {
  const h = db.health;
  for (const a of h.appointments) {
    // An unpaid transfer past its deadline frees the slot.
    if (a.status === 'awaiting_payment' && a.instructions && Date.parse(a.instructions.payBy) < now && a.paymentStatus !== 'proof_submitted') {
      a.status = 'cancelled';
      a.cancelledBy = 'system';
      a.cancelReason = 'The payment did not arrive before the deadline.';
      addEvent(a, 'cancelled', 'The payment did not arrive before the deadline.', now);
      notifyHealth(db, a.userId, 'appointment_update', 'Appointment cancelled', `Your appointment ${a.code} was cancelled because the payment did not arrive in time.`, {
        appointmentCode: a.code,
      });
    }
  }
};

export const addEvent = (a: MockAppointment, type: MockAppointment['events'][number]['type'], note: string | null, now: number) => {
  a.events.push({ type, note, createdAt: isoNow(now) });
};

export const notifyHealth = (
  db: MockDb,
  userId: string,
  type: 'appointment_update' | 'appointment_reminder' | 'appointment_new' | 'appointment_payment' | 'prescription_ready',
  title: string,
  body: string,
  data: { appointmentCode?: string; appointmentId?: string; prescriptionId?: string },
) => {
  const shop = db.shop;
  shop.notifications.push({
    id: `n_${(shop.seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    userId,
    type,
    title,
    body,
    data: {
      groupCode: null,
      orderId: null,
      returnId: null,
      productId: null,
      appointmentCode: data.appointmentCode ?? null,
      appointmentId: data.appointmentId ?? null,
      prescriptionId: data.prescriptionId ?? null,
    },
    isRead: false,
    createdAt: isoNow(),
  });
};

export const joinOpensAt = (a: MockAppointment) => new Date(Date.parse(a.startAt) - JOIN_EARLY_MIN * MINUTE).toISOString();
const joinClosesAt = (a: MockAppointment) => Date.parse(a.endAt) + JOIN_LATE_MIN * MINUTE;

export const canJoin = (a: MockAppointment, now: number) =>
  a.kind === 'video' &&
  (a.status === 'confirmed' || a.status === 'checked_in' || a.status === 'in_progress') &&
  now >= Date.parse(joinOpensAt(a)) &&
  now <= joinClosesAt(a);

export const cancelCutoff = (h: MockHealth, a: MockAppointment) =>
  doctorById(h, a.doctorId)?.bookingRules.cancelCutoffHours ?? 4;

export const patientFlags = (h: MockHealth, a: MockAppointment, now: number) => {
  const upcoming = Date.parse(a.startAt) > now;
  const cancellable = (a.status === 'awaiting_payment' || a.status === 'confirmed') && upcoming;
  return {
    canCancel: cancellable,
    canReschedule: cancellable && a.rescheduleCount < 1,
    canJoinVideo: canJoin(a, now),
    canReview: a.status === 'completed' && !a.reviewId && now - Date.parse(a.completedAt ?? a.endAt) < REVIEW_WINDOW_DAYS * DAY,
    canPay: a.status === 'awaiting_payment' && (a.paymentStatus === 'awaiting_transfer' || a.paymentStatus === 'proof_rejected'),
    canAttachRecords: isActive(a),
  };
};

export const isLateCancel = (h: MockHealth, a: MockAppointment, now: number) =>
  Date.parse(a.startAt) - now < cancelCutoff(h, a) * HOUR;

const patientAge = (a: MockAppointment, now: number) => ageFrom(a.patientDob, now);

const doctorRef = (h: MockHealth, a: MockAppointment) => {
  const d = doctorById(h, a.doctorId);
  return {
    id: a.doctorId,
    name: d ? `${d.title} ${d.name}`.trim() : 'Doctor',
    photoUrl: d?.photoUrl ?? null,
    specialty: specialtyRef(h, d?.specialtySlug ?? null),
  };
};

const locationRef = (h: MockHealth, a: MockAppointment) => {
  const l = locationById(h, a.locationId);
  return {
    id: a.locationId,
    kind: a.kind,
    name: l?.name ?? (a.kind === 'video' ? 'Video consultation' : 'Clinic'),
    area: l?.area ?? '',
    city: l?.city ?? '',
    address: l?.address ?? null,
    lat: l?.lat ?? null,
    lng: l?.lng ?? null,
    phone: l?.phone ?? null,
    instructions: l?.instructions ?? null,
  };
};

const tzOf = (h: MockHealth, a: MockAppointment) => locationById(h, a.locationId)?.timezone ?? PKT;

export const appointmentSummaryView = (h: MockHealth, a: MockAppointment, now: number) => {
  const flags = patientFlags(h, a, now);
  return {
    id: a.id,
    code: a.code,
    status: a.status,
    kind: a.kind,
    startAt: a.startAt,
    endAt: a.endAt,
    timezone: tzOf(h, a),
    doctor: doctorRef(h, a),
    location: locationRef(h, a),
    patientName: a.patientName,
    fee: a.fee,
    paymentStatus: a.paymentStatus,
    canJoinVideo: flags.canJoinVideo,
    canPay: flags.canPay,
    canReview: flags.canReview,
    joinOpensAt: a.kind === 'video' ? joinOpensAt(a) : null,
  };
};

const RELATION_LABEL: Record<string, string> = { spouse: 'Spouse', child: 'Child', parent: 'Parent', sibling: 'Sibling', other: 'Family' };

export const recordView = (h: MockHealth, r: MockHealth['records'][number]) => {
  const member = r.memberId ? h.family.find(f => f.id === r.memberId) : null;
  return { ...r, memberName: member ? member.name : 'Me' };
};

export const appointmentDetailView = (h: MockHealth, a: MockAppointment, now: number) => {
  const flags = patientFlags(h, a, now);
  const late = flags.canCancel && isLateCancel(h, a, now);
  const member = a.familyMemberId ? h.family.find(f => f.id === a.familyMemberId) : null;
  return {
    ...appointmentSummaryView(h, a, now),
    patient: {
      familyMemberId: a.familyMemberId,
      name: a.patientName,
      relation: member ? RELATION_LABEL[member.relation] : null,
      age: patientAge(a, now),
      gender: a.patientGender,
    },
    reasonTags: a.reasonTags,
    reason: a.reason,
    records: a.recordIds
      .map(id => h.records.find(r => r.id === id))
      .filter(Boolean)
      .map(r => recordView(h, r!)),
    payment: { method: a.paymentMethod, status: a.paymentStatus, amount: a.fee, instructions: a.instructions, proof: a.proof },
    timeline: a.events,
    flags,
    isLateCancel: late,
    lateCancelNote: late
      ? `This is within ${cancelCutoff(h, a)} hours of your appointment, so it is recorded as a late cancellation. The doctor can see how often this happens.`
      : null,
    cancelReason: a.cancelReason,
    rescheduleCount: a.rescheduleCount,
    prescriptionId: a.prescriptionId,
    reviewed: !!a.reviewId,
  };
};

// ─── Doctor side ──────────────────────────────────────
export const patientKey = (a: Pick<MockAppointment, 'userId' | 'familyMemberId'>) => `${a.userId}~${a.familyMemberId ?? 'self'}`;

export const doctorActions = (h: MockHealth, a: MockAppointment, now: number) => {
  const start = Date.parse(a.startAt);
  const sameDayOrSoon = start - now < 12 * HOUR;
  const awaitingProof = a.paymentStatus === 'proof_submitted';
  return {
    canCheckIn: a.kind === 'clinic' && a.status === 'confirmed' && sameDayOrSoon && now < Date.parse(a.endAt) + 2 * HOUR,
    canStart:
      (a.kind === 'clinic' && a.status === 'checked_in') ||
      (a.kind === 'video' && a.status === 'confirmed' && now >= Date.parse(joinOpensAt(a)) && now <= joinClosesAt(a)),
    canComplete: a.status === 'in_progress',
    canNoShow: (a.status === 'confirmed' || a.status === 'checked_in') && now >= start + 10 * MINUTE,
    canCancel: (a.status === 'awaiting_payment' || a.status === 'confirmed') && start > now,
    canConfirmPayment: awaitingProof,
    canWritePrescription: (a.status === 'in_progress' || a.status === 'completed') && !a.prescriptionId,
    canJoinVideo: canJoin(a, now),
  };
};

const firstVisit = (h: MockHealth, a: MockAppointment) =>
  !h.appointments.some(
    o => o.id !== a.id && o.doctorId === a.doctorId && patientKey(o) === patientKey(a) && o.status === 'completed' && o.startAt < a.startAt,
  );

export const queueItemView = (h: MockHealth, a: MockAppointment, now: number) => ({
  id: a.id,
  code: a.code,
  startAt: a.startAt,
  timezone: tzOf(h, a),
  kind: a.kind,
  status: a.status,
  patient: { name: a.patientName, age: patientAge(a, now), gender: a.patientGender },
  firstVisit: firstVisit(h, a),
  reason: [a.reasonTags.map(t => ({ follow_up: 'Follow-up', new_problem: 'New problem', reports_review: 'Reports review' })[t]).join(', '), a.reason]
    .filter(Boolean)
    .join(' · ') || null,
  checkedInAt: a.checkedInAt,
  paymentMethod: a.paymentMethod,
  paymentStatus: a.paymentStatus,
  locationId: a.locationId,
  locationName: locationById(h, a.locationId)?.name ?? '',
  canJoinVideo: canJoin(a, now),
  joinOpensAt: a.kind === 'video' ? joinOpensAt(a) : null,
  actions: doctorActions(h, a, now),
});

export const prescriptionView = (h: MockHealth, p: MockHealth['prescriptions'][number]) => {
  const a = h.appointments.find(x => x.id === p.appointmentId)!;
  const d = doctorById(h, p.doctorId);
  const l = a ? locationById(h, a.locationId) : null;
  return {
    id: p.id,
    appointmentCode: a?.code ?? '',
    doctorId: p.doctorId,
    locationId: a?.locationId ?? '',
    kind: a?.kind ?? 'clinic',
    doctor: {
      name: d ? `${d.title} ${d.name}` : 'Doctor',
      specialtyName: specialtyRef(h, d?.specialtySlug ?? null).name,
      qualifications: d ? qualificationLine(d) : '',
      pmdcNumber: d?.pmdcNumber ?? '',
      place: l ? (l.kind === 'video' ? 'Video consultation' : `${l.name}, ${l.area}, ${l.city}`) : '',
      phone: l?.phone ?? null,
    },
    patient: { name: a?.patientName ?? 'Patient', age: a ? ageFrom(a.patientDob, Date.parse(p.issuedAt)) : null, gender: a?.patientGender ?? null },
    issuedAt: p.issuedAt,
    diagnosis: p.diagnosis,
    medicines: p.medicines,
    tests: p.tests,
    advice: p.advice,
    followUpInDays: p.followUpInDays,
    editableUntil: new Date(Date.parse(p.issuedAt) + PRESCRIPTION_EDIT_HOURS * HOUR).toISOString(),
  };
};

export const previousVisitsOf = (h: MockHealth, a: Pick<MockAppointment, 'doctorId' | 'userId' | 'familyMemberId'>, exceptId?: string) =>
  h.appointments
    .filter(o => o.id !== exceptId && o.doctorId === a.doctorId && patientKey(o) === patientKey(a) && o.status === 'completed')
    .sort((x, y) => y.startAt.localeCompare(x.startAt))
    .map(o => {
      const p = o.prescriptionId ? h.prescriptions.find(x => x.id === o.prescriptionId) : null;
      return { code: o.code, startAt: o.startAt, kind: o.kind, diagnosis: p?.diagnosis ?? null, prescriptionId: o.prescriptionId, notes: o.notes.text || null };
    });

export const doctorAppointmentView = (h: MockHealth, a: MockAppointment, now: number) => {
  const others = h.appointments.filter(o => o.doctorId === a.doctorId && patientKey(o) === patientKey(a));
  const p = a.prescriptionId ? h.prescriptions.find(x => x.id === a.prescriptionId) : null;
  return {
    id: a.id,
    code: a.code,
    status: a.status,
    kind: a.kind,
    startAt: a.startAt,
    endAt: a.endAt,
    timezone: tzOf(h, a),
    location: locationRef(h, a),
    patient: {
      id: patientKey(a),
      name: a.patientName,
      age: patientAge(a, now),
      gender: a.patientGender,
      phone: a.patientPhone,
      visitsWithYou: others.filter(o => o.status === 'completed').length,
      noShows: others.filter(o => o.status === 'no_show').length,
      lateCancels: others.filter(o => o.status === 'cancelled' && o.lateCancel).length,
    },
    reasonTags: a.reasonTags,
    reason: a.reason,
    records: a.recordIds
      .map(id => h.records.find(r => r.id === id))
      .filter(Boolean)
      .map(r => recordView(h, r!)),
    previousVisits: previousVisitsOf(h, a, a.id),
    notes: a.notes,
    payment: { method: a.paymentMethod, status: a.paymentStatus, amount: a.fee, instructions: a.instructions, proof: a.proof },
    checkedInAt: a.checkedInAt,
    actions: doctorActions(h, a, now),
    prescription: p ? prescriptionView(h, p) : null,
    timeline: a.events,
  };
};

// ─── Symptom checker (rules, not a diagnosis) ─────────
const RED_FLAGS: RegExp[] = [
  /chest (pain|tightness|pressure)/i,
  /(can'?t|cannot|difficulty|trouble|hard to) breath/i,
  /short(ness)? of breath/i,
  /unconscious|fainted|passed out|not waking/i,
  /(heavy|severe|won'?t stop) bleed/i,
  /face (droop|drooping)|slurred speech|one side (weak|numb)|stroke/i,
  /seizure|fits?\b|convulsion/i,
  /suicid|kill myself|end my life/i,
  /poison|overdose|swallowed (bleach|chemicals?|pills)/i,
  /severe burn|head injury|accident/i,
  /سینے میں درد|سانس (نہیں|لینے میں)|بے ہوش/,
];

interface SymptomRule {
  re: RegExp;
  specialty: string;
  areas: { title: string; body: string }[];
}

const RULES: SymptomRule[] = [
  {
    re: /pimple|acne|rash|itch|eczema|skin|dandruff|hair (fall|loss)|دانے|خارش|جلد/i,
    specialty: 'dermatologist',
    areas: [
      { title: 'Skin changes', body: 'A dermatologist can look at the spots or rash, ask how long they have been there and what makes them worse.' },
      { title: 'Products and triggers', body: 'Bring the names of creams, soaps or medicines you use; some can cause or worsen skin problems.' },
    ],
  },
  {
    re: /fever|temperature|cold|flu|cough|body ache|بخار|کھانسی|نزلہ/i,
    specialty: 'general-physician',
    areas: [
      { title: 'Fever and infection', body: 'A general physician can check for common infections and decide whether you need a test, such as a blood count.' },
      { title: 'How long and how high', body: 'Note how many days it has lasted and the highest temperature you measured.' },
    ],
  },
  {
    re: /sore throat|throat|tonsil|ear|nose|sinus|گلا|کان/i,
    specialty: 'ent-specialist',
    areas: [{ title: 'Ear, nose and throat', body: 'An ENT specialist can examine your throat, ears and sinuses.' }],
  },
  {
    re: /stomach|tummy|abdomen|acidity|heartburn|diarrh|loose motion|vomit|nausea|constipat|پیٹ|تیزابیت/i,
    specialty: 'gastroenterologist',
    areas: [
      { title: 'Digestion', body: 'A gastroenterologist can ask about meals, pain timing and bowel habits.' },
      { title: 'Fluids', body: 'With vomiting or loose motions, mention how much you are able to drink.' },
    ],
  },
  {
    re: /headache|migraine|dizz|numb|سر درد/i,
    specialty: 'neurologist',
    areas: [{ title: 'Headaches', body: 'A neurologist can ask how often the headaches come, how long they last and what helps.' }],
  },
  {
    re: /back pain|joint|knee|shoulder|neck pain|sprain|کمر|جوڑ/i,
    specialty: 'orthopedic-surgeon',
    areas: [{ title: 'Bones and joints', body: 'An orthopaedic doctor can check movement and decide whether an X-ray helps.' }],
  },
  {
    re: /period|pregnan|pcos|vaginal|حمل|ماہواری/i,
    specialty: 'gynecologist',
    areas: [{ title: "Women's health", body: 'A gynaecologist can discuss your cycle, pregnancy or other concerns in private.' }],
  },
  {
    re: /baby|child|infant|toddler|vaccin|بچ/i,
    specialty: 'pediatrician',
    areas: [{ title: "Your child's health", body: 'A paediatrician can check growth, fever and feeding, and the vaccination schedule.' }],
  },
  {
    re: /anxi|stress|panic|depress|sad|sleep|insomnia|ڈپریشن|نیند/i,
    specialty: 'psychiatrist',
    areas: [{ title: 'Mood and sleep', body: 'A psychiatrist or psychologist can talk through how you have been feeling and sleeping.' }],
  },
  {
    re: /eye|vision|blurr|آنکھ/i,
    specialty: 'eye-specialist',
    areas: [{ title: 'Eyes and vision', body: 'An eye specialist can test your vision and examine your eyes.' }],
  },
  {
    re: /tooth|teeth|gum|دانت/i,
    specialty: 'dentist',
    areas: [{ title: 'Teeth and gums', body: 'A dentist can examine the painful tooth and gums.' }],
  },
  {
    re: /sugar|diabet|thyroid|شوگر/i,
    specialty: 'endocrinologist',
    areas: [{ title: 'Sugar and hormones', body: 'Bring recent sugar readings or thyroid tests if you have them.' }],
  },
  {
    re: /blood pressure|\bbp\b|palpitation|heart/i,
    specialty: 'cardiologist',
    areas: [{ title: 'Heart and blood pressure', body: 'Bring your recent blood pressure readings and the medicines you take.' }],
  },
  {
    re: /urine|burning|kidney|پیشاب/i,
    specialty: 'urologist',
    areas: [{ title: 'Urine and kidneys', body: 'A urologist may ask for a urine test.' }],
  },
  {
    re: /asthma|wheez|breathless|chronic cough/i,
    specialty: 'pulmonologist',
    areas: [{ title: 'Breathing', body: 'A chest specialist can check your breathing and may suggest a lung test.' }],
  },
];

export const EMERGENCY_NUMBERS = [
  { label: 'Rescue 1122', number: '1122' },
  { label: 'Edhi ambulance', number: '115' },
  { label: 'Police', number: '15' },
];

export const DISCLAIMER =
  'This is general information, not a diagnosis. Only a doctor who examines you can diagnose and treat you. If symptoms are severe or getting worse, call 1122.';

export const checkSymptoms = (h: MockHealth, text: string) => {
  if (RED_FLAGS.some(re => re.test(text))) {
    return { emergency: true, emergencyNumbers: EMERGENCY_NUMBERS, areas: [], specialty: null, disclaimer: DISCLAIMER };
  }
  const hits = RULES.filter(r => r.re.test(text));
  const rule = hits[0];
  const slug = rule?.specialty ?? 'general-physician';
  const areas = (hits.length ? hits.flatMap(r => r.areas) : RULES[1].areas).slice(0, 3);
  return { emergency: false, emergencyNumbers: EMERGENCY_NUMBERS, areas, specialty: specialtyRef(h, slug), disclaimer: DISCLAIMER };
};

/** A Jitsi room only this appointment's two people know (meet.jit.si: deep links to the app turned off). */
export const roomUrl = (a: MockAppointment, displayName: string) =>
  `https://meet.jit.si/MetroMatrix-${a.code.replace(/[^A-Z0-9]/gi, '')}-${a.roomSecret}` +
  `#config.prejoinPageEnabled=false&config.disableDeepLinking=true&userInfo.displayName=${encodeURIComponent(JSON.stringify(displayName))}`;

