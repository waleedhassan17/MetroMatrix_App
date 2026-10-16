// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Health routes (every endpoint in API_HEALTH_ASSUMED)
// ═══════════════════════════════════════════════════════
// Patients under /healthcare, the doctor partner under /healthcare/doctor,
// staff under /admin/healthcare. Writes are all-or-nothing, like the shop's.

import type { MockBusiness, MockDb, MockUser } from '../mockDb';
import type { ShopCtx, ShopKit } from '../shop/shopRoutes';
import type { MockAppointment, MockDoctor, MockHealth, MockHealthBanner, MockLocation } from './healthTypes';
import type { AppointmentPaymentMethod, ConsultKind, Medicine, ReasonTag, WeekDayHours } from '../../../../types/health';
import { PKT, addDays, ageFrom, dateInZone, todayInZone } from '../../../../utils/healthTime';
import {
  DAY,
  HOUR,
  HealthError,
  MINUTE,
  PAY_WINDOW_MIN,
  PRESCRIPTION_EDIT_HOURS,
  REPLY_EDIT_HOURS,
  REVIEW_WINDOW_DAYS,
  addEvent,
  alternativesAfter,
  appointmentCode,
  appointmentDetailView,
  appointmentSummaryView,
  canJoin,
  checkSymptoms,
  doctorActions,
  doctorAppointmentView,
  doctorById,
  doctorCardView,
  doctorLocationView,
  doctorOfOwner,
  doctorProfileView,
  earliestOf,
  EMERGENCY_NUMBERS,
  isActive,
  isLateCancel,
  isoNow,
  locationById,
  locationsOf,
  nextId,
  notifyHealth,
  patientFlags,
  patientKey,
  prescriptionView,
  previousVisitsOf,
  queueItemView,
  recordView,
  reviewSummaryView,
  reviewView,
  roomUrl,
  servesCity,
  settleAppointments,
  slotsFor,
  specialtyBySlug,
  specialtyView,
  visibleReviews,
} from './healthLogic';

export interface HealthKit extends ShopKit {
  /** The business as the API sends it (session payloads, publish). */
  publicBusiness: (b: MockBusiness) => unknown;
}

const bad = (message: string, fields: Record<string, string>, extra: Record<string, unknown> = {}) =>
  new HealthError(400, 'VALIDATION_FAILED', message, {
    fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, [v]])),
    ...extra,
  });
const notFound = (what: string) => new HealthError(404, 'NOT_FOUND', `${what} not found.`);
const transition = (message: string) => new HealthError(409, 'INVALID_TRANSITION', message);

const page = (q: Record<string, any>) => {
  const p = Math.max(1, Math.floor(Number(q.page) || 1));
  const size = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)));
  return { page: p, pageSize: size };
};
const paginate = <T>(rows: T[], q: Record<string, any>) => {
  const { page: p, pageSize } = page(q);
  return { items: rows.slice((p - 1) * pageSize, p * pageSize), total: rows.length, page: p, pageSize };
};
const bool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';
const num = (v: unknown): number | null => (v === undefined || v === null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

const norm = (s: string) => s.toLowerCase().normalize('NFKC').trim();
const matches = (q: string, ...hay: (string | null | undefined)[]) => {
  const n = norm(q);
  return !!n && hay.some(h => h && norm(h).includes(n));
};

const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The Pakistan-day date of an ISO instant (dashboards, "today"). */
const pkDay = (iso: string) => dateInZone(iso, PKT);

/** The doctor ladder of a patient's appointments: soonest first for upcoming, latest first for past. */
const upcomingFirst = (a: MockAppointment, b: MockAppointment) => a.startAt.localeCompare(b.startAt);
const latestFirst = (a: MockAppointment, b: MockAppointment) => b.startAt.localeCompare(a.startAt);

/** Video can be tested any time: customer@ always has a consult with Dr. Bilal starting within 15 minutes. */
const ensureDemoVideo = (h: MockHealth, now: number) => {
  const loc = h.locations.find(l => l.doctorId === 'd_bilal' && l.kind === 'video' && l.isActive);
  if (!loc) return;
  const live = h.appointments.some(
    a =>
      a.userId === 'u_customer' &&
      a.doctorId === 'd_bilal' &&
      a.kind === 'video' &&
      (a.status === 'confirmed' || a.status === 'checked_in' || a.status === 'in_progress') &&
      Date.parse(a.endAt) + 30 * MINUTE > now &&
      Date.parse(a.startAt) < now + 60 * MINUTE,
  );
  if (live) return;
  const step = 5 * MINUTE;
  const start = Math.ceil((now + 5 * MINUTE) / step) * step;
  const a = newAppointment(h, {
    doctorId: 'd_bilal',
    loc,
    startAt: new Date(start).toISOString(),
    userId: 'u_customer',
    familyMemberId: null,
    patientName: 'Ayesha Khan',
    patientDob: '1995-04-12',
    patientGender: 'female',
    patientPhone: '+923001234567',
    reasonTags: ['follow_up'],
    reason: 'Video follow-up (demo consultation)',
    recordIds: [],
    paymentMethod: 'pay_at_visit',
    now,
  });
  a.status = 'confirmed';
  addEvent(a, 'confirmed', null, now);
  h.appointments.push(a);
};

const newAppointment = (
  h: MockHealth,
  o: {
    doctorId: string;
    loc: MockLocation;
    startAt: string;
    userId: string;
    familyMemberId: string | null;
    patientName: string;
    patientDob: string | null;
    patientGender: MockAppointment['patientGender'];
    patientPhone: string | null;
    reasonTags: ReasonTag[];
    reason: string | null;
    recordIds: string[];
    paymentMethod: AppointmentPaymentMethod;
    now: number;
  },
): MockAppointment => ({
  id: nextId(h, 'ap'),
  code: appointmentCode(h),
  doctorId: o.doctorId,
  locationId: o.loc.id,
  userId: o.userId,
  familyMemberId: o.familyMemberId,
  patientName: o.patientName,
  patientDob: o.patientDob,
  patientGender: o.patientGender,
  patientPhone: o.patientPhone,
  kind: o.loc.kind,
  startAt: o.startAt,
  endAt: new Date(Date.parse(o.startAt) + o.loc.slotMinutes * MINUTE).toISOString(),
  status: o.paymentMethod === 'transfer' ? 'awaiting_payment' : 'confirmed',
  reasonTags: o.reasonTags,
  reason: o.reason,
  recordIds: o.recordIds,
  paymentMethod: o.paymentMethod,
  paymentStatus: o.paymentMethod === 'transfer' ? 'awaiting_transfer' : 'pay_at_visit',
  fee: o.loc.fee,
  instructions: null,
  proof: null,
  events: [{ type: 'booked', note: null, createdAt: isoNow(o.now) }],
  checkedInAt: null,
  startedAt: null,
  completedAt: null,
  cancelledBy: null,
  cancelReason: null,
  lateCancel: false,
  rescheduleCount: 0,
  notes: { text: '', attachments: [], updatedAt: null },
  prescriptionId: null,
  reviewId: null,
  roomSecret: Math.random().toString(36).slice(2, 12),
  createdAt: isoNow(o.now),
});

/** A newly approved doctor gets their (unlisted) practice on first visit. */
const ensureDoctor = (db: MockDb, user: MockUser, business: MockBusiness): MockDoctor => {
  const h = db.health;
  const existing = doctorOfOwner(h, user.id);
  if (existing) return existing;
  const wanted = norm(business.details?.specialty ?? '');
  const spec = h.specialties.find(s => norm(s.name) === wanted || wanted.startsWith(norm(s.name).slice(0, 6)));
  const doctor: MockDoctor = {
    id: nextId(h, 'd'),
    ownerId: user.id,
    businessId: business.id,
    title: 'Dr.',
    name: user.name.replace(/^dr\.?\s+/i, ''),
    gender: user.gender === 'male' || user.gender === 'female' ? user.gender : 'other',
    photoUrl: user.avatarUrl,
    specialtySlug: spec?.slug ?? 'general-physician',
    secondarySpecialtySlug: null,
    practisingSince: null,
    languages: ['Urdu', 'English'],
    about: business.details?.briefDescription ?? '',
    qualifications: [],
    experience: [],
    services: [],
    conditionSlugs: [],
    bookingRules: { windowDays: 14, minNoticeMinutes: 60, cancelCutoffHours: 4, videoPrepay: false },
    pmdcNumber: business.details?.pmdcNumber ?? '',
    isListed: false,
    topBooked: false,
    city: business.city,
    previewSeen: false,
    createdAt: isoNow(),
  };
  h.doctors.push(doctor);
  return doctor;
};

const COMPLETENESS = (h: MockHealth, d: MockDoctor) => {
  const locs = locationsOf(h, d.id);
  const items = [
    { key: 'photo', label: 'Profile photo', done: !!d.photoUrl },
    { key: 'about', label: 'About you', done: d.about.trim().length >= 50 },
    { key: 'qualifications', label: 'Qualifications', done: d.qualifications.length > 0 },
    { key: 'services', label: 'Services and conditions', done: d.services.length > 0 && d.conditionSlugs.length > 0 },
    { key: 'location', label: 'At least one location', done: locs.length > 0 },
    { key: 'hours', label: 'Weekly hours', done: locs.some(l => l.hours.some(x => x.ranges.length)) },
    { key: 'preview', label: 'Preview what patients see', done: d.previewSeen },
  ];
  const done = items.filter(i => i.done).length;
  const percent = Math.round((done / items.length) * 100);
  return { items, percent, isListed: d.isListed, canPublish: percent === 100 && !d.isListed };
};

const ownProfileView = (h: MockHealth, d: MockDoctor) => ({
  title: d.title,
  name: d.name,
  gender: d.gender,
  photoUrl: d.photoUrl,
  specialtySlug: d.specialtySlug,
  specialtyName: specialtyBySlug(h, d.specialtySlug)?.name ?? '',
  secondarySpecialtySlug: d.secondarySpecialtySlug,
  practisingSince: d.practisingSince,
  languages: d.languages,
  about: d.about,
  qualifications: d.qualifications,
  experience: d.experience,
  services: d.services,
  conditionSlugs: d.conditionSlugs,
  bookingRules: d.bookingRules,
  pmdcNumber: d.pmdcNumber,
  isListed: d.isListed,
});

/** Within-day validity of a week; a clash with another location is checked separately. */
const weekErrors = (hours: WeekDayHours[]) => {
  const fields: Record<string, string> = {};
  for (const d of hours) {
    d.ranges.forEach((r, i) => {
      if (!HHMM.test(r.from) || !HHMM.test(r.to)) fields[`day.${d.day}.${i}`] = 'Use times like 09:00';
      else if (toMin(r.to) - toMin(r.from) < 15) fields[`day.${d.day}.${i}`] = 'At least 15 minutes, ending after it starts';
      else if (d.ranges.some((o, j) => j !== i && toMin(r.from) < toMin(o.to) && toMin(o.from) < toMin(r.to))) fields[`day.${d.day}.${i}`] = 'Overlaps another range';
    });
  }
  return fields;
};

const cleanWeek = (raw: unknown): WeekDayHours[] =>
  [1, 2, 3, 4, 5, 6, 7].map(day => {
    const found = Array.isArray(raw) ? raw.find((x: any) => Number(x?.day) === day) : null;
    const ranges = Array.isArray(found?.ranges) ? found.ranges.map((r: any) => ({ from: String(r?.from ?? ''), to: String(r?.to ?? '') })) : [];
    return { day, ranges };
  });

const DOSE = /^(\d+(\.5)?|½)\+(\d+(\.5)?|½)\+(\d+(\.5)?|½)$/;
const cleanMedicines = (raw: unknown): Medicine[] =>
  (Array.isArray(raw) ? raw : [])
    .filter((m: any) => text(m?.name))
    .map((m: any) => ({
      name: text(m.name),
      strength: text(m.strength),
      form: m.form ?? 'tablet',
      dose: String(m.dose ?? '').replace(/\s/g, ''),
      timing: m.timing ?? null,
      days: Math.round(Number(m.days) || 0),
      instructions: text(m.instructions) || null,
    }));

const validatePrescription = (body: Record<string, any>) => {
  const diagnosis = text(body.diagnosis);
  const medicines = cleanMedicines(body.medicines);
  const tests: string[] = Array.isArray(body.tests) ? body.tests.map(text).filter(Boolean) : [];
  const advice = text(body.advice) || null;
  const follow = num(body.followUpInDays);
  const fields: Record<string, string> = {};
  if (diagnosis.length < 2) fields.diagnosis = 'Enter the diagnosis';
  if (!medicines.length && !tests.length && !advice) fields.medicines = 'Add a medicine, a test or advice';
  medicines.forEach((m, i) => {
    if (!DOSE.test(m.dose)) fields[`medicine.${i}.dose`] = 'Use a pattern like 1+0+1';
    if (m.days < 1 || m.days > 365) fields[`medicine.${i}.days`] = '1 to 365 days';
  });
  if (Object.keys(fields).length) throw bad('Check the prescription.', fields);
  return { diagnosis, medicines, tests, advice, followUpInDays: follow && follow > 0 ? Math.round(follow) : null };
};

export function registerHealthRoutes(kit: HealthKit) {
  const { requireUser, optionalUser, requirePartnerBusiness, requireAdmin, publicBusiness } = kit;

  // Writes are all-or-nothing: a request that fails part-way leaves the
  // dummy database exactly as it was (notifications included).
  const route: ShopKit['route'] = (method, pattern, handler) =>
    kit.route(method, pattern, ctx => {
      settleAppointments(ctx.db, ctx.now);
      if (method === 'GET') return handler(ctx);
      const before = JSON.stringify(ctx.db.health);
      const notes = ctx.db.shop.notifications.length;
      try {
        return handler(ctx);
      } catch (e) {
        // A request may fail on purpose after a real change (mock mode's
        // contested slot is genuinely gone): it says so with keepChanges.
        if (!(e as { keepChanges?: boolean }).keepChanges) {
          ctx.db.health = JSON.parse(before);
          ctx.db.shop.notifications.length = notes;
        }
        throw e;
      }
    });

  const requireCustomer = (ctx: ShopCtx) => {
    const user = requireUser(ctx);
    if (user.role !== 'customer') throw new HealthError(403, 'FORBIDDEN', 'Only patients can do this.');
    if (!user.isEmailVerified) throw new HealthError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email first.');
    return user;
  };

  const myDoctor = (ctx: ShopCtx) => {
    const { user, business } = requirePartnerBusiness(ctx);
    if (!business || business.serviceType !== 'healthcare') {
      throw new HealthError(403, 'WRONG_SERVICE', 'Only doctors can do this.', { required: 'healthcare', actual: business?.serviceType ?? null });
    }
    if (business.status !== 'approved') {
      throw new HealthError(403, 'BUSINESS_NOT_APPROVED', 'Your practice opens once MetroMatrix approves it.', { status: business.status });
    }
    return { user, business, doctor: ensureDoctor(ctx.db, user, business) };
  };

  /** The patient's own appointment by code (404 for anyone else's). */
  const myAppointment = (ctx: ShopCtx, user: MockUser) => {
    const code = decodeURIComponent(ctx.params[0]).toUpperCase();
    const a = ctx.db.health.appointments.find(x => x.code === code && x.userId === user.id);
    if (!a) throw notFound('Appointment');
    return a;
  };

  /** The doctor's own appointment by id. */
  const doctorAppointment = (ctx: ShopCtx, doctor: MockDoctor) => {
    const a = ctx.db.health.appointments.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.doctorId === doctor.id);
    if (!a) throw notFound('Appointment');
    return a;
  };

  const listedDoctor = (h: MockHealth, id: string) => {
    const d = doctorById(h, decodeURIComponent(id));
    if (!d || !d.isListed) throw notFound('Doctor');
    return d;
  };

  const defaultCity = (db: MockDb, user: MockUser | null) => {
    if (!user) return 'Lahore';
    const address = db.shop.addresses.filter(a => a.userId === user.id).sort((a, b) => Number(b.isDefault) - Number(a.isDefault))[0];
    return address?.city ?? user.city ?? 'Lahore';
  };

  // ══ Discovery (public) ═══════════════════════════════
  /**
   * The home's promotions: active, inside their window, for this city (or
   * every city), with a target the patient can still open — resolved to its
   * id, slug and name. TODO(API_HEALTH): banners.
   */
  const liveBanners = (h: MockHealth, city: string, now: number) =>
    (h.banners ?? [])
      .filter(b => b.isActive && (!b.startsAt || Date.parse(b.startsAt) <= now) && (!b.endsAt || Date.parse(b.endsAt) > now))
      .filter(b => !b.city || b.city.toLowerCase() === city.toLowerCase())
      .map(b => {
        let target: { id: string; slug?: string; name: string } | null = null;
        if (b.targetType === 'specialty') {
          const sp = h.specialties.find(x => x.id === b.targetId);
          target = sp ? { id: sp.id, slug: sp.slug, name: sp.name } : null;
        } else if (b.targetType === 'condition') {
          const c = h.conditions.find(x => x.id === b.targetId);
          target = c ? { id: c.id, slug: c.slug, name: c.name } : null;
        } else if (b.targetType === 'doctor') {
          const d = h.doctors.find(x => x.id === b.targetId && x.isListed);
          target = d ? { id: d.id, name: `${d.title} ${d.name}` } : null;
        }
        const openable = b.targetType === 'screen' ? !!b.targetScreen : b.targetType === 'none' || !!target;
        return openable ? { b, target } : null;
      })
      .filter((x): x is { b: MockHealthBanner; target: { id: string; slug?: string; name: string } | null } => !!x)
      .sort((x, y) => x.b.sort - y.b.sort)
      .slice(0, 10)
      .map(({ b, target }) => ({
        id: b.id,
        imageUrl: b.imageUrl,
        title: b.title,
        subtitle: b.subtitle,
        targetType: b.targetType,
        targetScreen: b.targetScreen,
        target,
      }));

  route('GET', '/healthcare/home', ctx => {
    const { db, now, query } = ctx;
    const h = db.health;
    const user = optionalUser(ctx);
    const city = text(query.city) || defaultCity(db, user);
    if (user?.id === 'u_customer') ensureDemoVideo(h, now);
    const cities = [...new Set(h.locations.filter(l => l.kind === 'clinic' && l.isActive).map(l => l.city))].sort();
    const listed = h.doctors.filter(d => d.isListed && servesCity(h, d, city));
    const today = todayInZone(PKT, now);
    const availableToday = listed
      .map(d => ({ d, best: earliestOf(h, d, now) }))
      .filter(x => x.best && x.best.next.date === today)
      .sort((a, b) => a.best!.next.startAt.localeCompare(b.best!.next.startAt))
      .slice(0, 10)
      .map(x => doctorCardView(h, x.d, now));
    const upcoming =
      user && user.role === 'customer'
        ? h.appointments.filter(a => a.userId === user.id && isActive(a) && Date.parse(a.endAt) + 30 * MINUTE > now).sort(upcomingFirst)[0]
        : null;
    return {
      city,
      cities,
      specialties: [...h.specialties].sort((a, b) => a.sort - b.sort).slice(0, 12).map(s => specialtyView(h, s.slug, city)),
      commonConditions: h.conditions.filter(c => c.isCommon).map(({ aliases: _a, ...c }) => c),
      availableToday,
      // The city's best-rated doctors (most reviews breaks a tie).
      featuredDoctors: listed
        .map(d => doctorCardView(h, d, now))
        .sort((x, y) => (y.rating ?? 0) - (x.rating ?? 0) || y.reviewCount - x.reviewCount)
        .slice(0, 10),
      banners: liveBanners(h, city, now),
      upcoming: upcoming ? appointmentSummaryView(h, upcoming, now) : null,
      emergencyNumbers: EMERGENCY_NUMBERS,
    };
  });

  route('GET', '/healthcare/specialties', ({ db, query }) => {
    const h = db.health;
    const city = text(query.city) || null;
    return [...h.specialties].sort((a, b) => a.sort - b.sort).map(s => specialtyView(h, s.slug, city));
  });

  route('GET', '/healthcare/conditions', ({ db, query }) => {
    const q = text(query.q);
    return db.health.conditions
      .filter(c => !q || matches(q, c.name, c.nameUr, ...c.aliases))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ aliases: _a, ...c }) => c);
  });

  route('GET', '/healthcare/search/suggest', ({ db, query }) => {
    const h = db.health;
    const q = text(query.q);
    if (q.length < 1) return { doctors: [], specialties: [], conditions: [] };
    const conditions = h.conditions.filter(c => matches(q, c.name, c.nameUr, ...c.aliases));
    const specialties = h.specialties.filter(
      s => matches(q, s.name, s.nameUr, s.slug.replace(/-/g, ' ')) || conditions.some(c => c.specialtySlug === s.slug),
    );
    const doctors = h.doctors
      .filter(d => d.isListed)
      .filter(
        d =>
          matches(q, d.name, `${d.title} ${d.name}`) ||
          specialties.some(s => s.slug === d.specialtySlug) ||
          conditions.some(c => d.conditionSlugs.includes(c.slug)),
      )
      .sort((a, b) => Number(matches(q, b.name)) - Number(matches(q, a.name)) || Number(b.topBooked) - Number(a.topBooked))
      .slice(0, 5)
      .map(d => ({ id: d.id, name: `${d.title} ${d.name}`, specialtyName: specialtyBySlug(h, d.specialtySlug)?.name ?? '' }));
    return {
      doctors,
      specialties: specialties.slice(0, 5).map(s => specialtyView(h, s.slug, null)),
      conditions: conditions.slice(0, 6).map(({ aliases: _a, ...c }) => c),
    };
  });

  route('GET', '/healthcare/doctors', ({ db, now, query }) => {
    const h = db.health;
    const kind: ConsultKind | null = query.kind === 'video' || query.kind === 'clinic' ? query.kind : null;
    const city = text(query.city);
    const q = text(query.q);
    const maxFee = num(query.maxFee);
    const minYears = num(query.minYears);
    const minRating = num(query.minRating);
    const today = todayInZone(PKT, now);
    const year = new Date(now).getUTCFullYear();
    let rows = h.doctors
      .filter(d => d.isListed)
      .filter(d => !query.specialty || d.specialtySlug === query.specialty || d.secondarySpecialtySlug === query.specialty)
      .filter(d => !query.condition || d.conditionSlugs.includes(String(query.condition)))
      .filter(d => {
        if (!q) return true;
        const conds = h.conditions.filter(c => matches(q, c.name, c.nameUr, ...c.aliases)).map(c => c.slug);
        const spec = specialtyBySlug(h, d.specialtySlug);
        return matches(q, d.name, spec?.name, spec?.nameUr) || d.conditionSlugs.some(s => conds.includes(s));
      })
      .filter(d => !city || (kind === 'video' ? true : kind === 'clinic' ? locationsOf(h, d.id).some(l => l.kind === 'clinic' && l.city === city) : servesCity(h, d, city)))
      .filter(d => !kind || locationsOf(h, d.id).some(l => l.kind === kind))
      .filter(d => !query.gender || d.gender === query.gender)
      .filter(d => maxFee === null || locationsOf(h, d.id).some(l => (!kind || l.kind === kind) && l.fee <= maxFee))
      .filter(d => minYears === null || (d.practisingSince !== null && year - d.practisingSince >= minYears))
      .filter(d => !query.language || d.languages.includes(String(query.language)))
      .filter(d => !query.area || locationsOf(h, d.id).some(l => l.kind === 'clinic' && matches(String(query.area), l.area)))
      .map(d => ({ d, card: doctorCardView(h, d, now, kind) }))
      .filter(x => minRating === null || (x.card.rating ?? 0) >= minRating)
      .filter(x => !bool(query.availableToday) || (x.card.availability.nextAt && dateInZone(x.card.availability.nextAt, PKT) === today));
    const sort = String(query.sort ?? 'recommended');
    const score = (x: (typeof rows)[number]) => (x.card.rating ?? 4) * Math.log10(10 + x.card.reviewCount) + (x.d.topBooked ? 1 : 0);
    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case 'earliest':
          return (a.card.availability.nextAt ?? '9').localeCompare(b.card.availability.nextAt ?? '9');
        case 'fee_low':
          return a.card.fromFee - b.card.fromFee;
        case 'most_reviewed':
          return b.card.reviewCount - a.card.reviewCount;
        case 'most_experienced':
          return b.card.yearsExperience - a.card.yearsExperience;
        default:
          return score(b) - score(a);
      }
    });
    return paginate(rows.map(x => x.card), query);
  });

  route('GET', '/healthcare/doctors/:id', ({ db, now, params }) => doctorProfileView(db.health, listedDoctor(db.health, params[0]), now));

  const locationOf = (h: MockHealth, doctorId: string, locId: string) => {
    const d = listedDoctor(h, doctorId);
    const loc = locationById(h, decodeURIComponent(locId));
    if (!loc || loc.doctorId !== d.id || !loc.isActive) throw notFound('Location');
    return loc;
  };

  route('GET', '/healthcare/doctors/:id/locations/:loc/days', ({ db, now, params, query }) => {
    const h = db.health;
    const loc = locationOf(h, params[0], params[1]);
    const today = todayInZone(loc.timezone, now);
    const from = DATE.test(String(query.from ?? '')) && String(query.from) > today ? String(query.from) : today;
    const n = Math.min(31, Math.max(1, Math.round(num(query.days) ?? 14)));
    return Array.from({ length: n }, (_, i) => {
      const date = addDays(from, i);
      return { date, slotCount: slotsFor(h, loc, date, now).length };
    });
  });

  route('GET', '/healthcare/doctors/:id/locations/:loc/slots', ({ db, now, params, query }) => {
    const h = db.health;
    const loc = locationOf(h, params[0], params[1]);
    const date = DATE.test(String(query.date ?? '')) ? String(query.date) : todayInZone(loc.timezone, now);
    const slots = slotsFor(h, loc, date, now);
    const next = slots.length ? null : (() => {
      const after = alternativesAfter(h, loc, `${date}T23:59:59.999Z`, now, 1);
      return after[0] ? { date: dateInZone(after[0].startAt, loc.timezone), startAt: after[0].startAt } : null;
    })();
    return { date, timezone: loc.timezone, slots, nextAvailable: next };
  });

  route('GET', '/healthcare/doctors/:id/reviews', ({ db, now, params, query }) => {
    const h = db.health;
    const d = listedDoctor(h, params[0]);
    const kind = query.kind === 'video' || query.kind === 'clinic' ? query.kind : null;
    const stars = num(query.rating);
    const rows = visibleReviews(h, d.id)
      .filter(r => !kind || r.kind === kind)
      .filter(r => stars === null || r.rating === stars)
      .sort((a, b) =>
        query.sort === 'highest' ? b.rating - a.rating || b.createdAt.localeCompare(a.createdAt) : query.sort === 'lowest' ? a.rating - b.rating : b.createdAt.localeCompare(a.createdAt),
      )
      .map(r => reviewView(r, now));
    return paginate(rows, query);
  });

  // ══ Appointments (patient) ═══════════════════════════
  route('POST', '/healthcare/appointments', ctx => {
    const { db, now, body, headers } = ctx;
    const h = db.health;
    const user = requireCustomer(ctx);
    const key = headers['idempotency-key'];
    if (!key) throw new HealthError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Missing Idempotency-Key.');
    const replay = h.idempotency[`${user.id}|${key}`];
    if (replay) {
      ctx.setStatus(replay.status);
      return replay.payload;
    }
    const doctor = listedDoctor(h, String(body.doctorId ?? ''));
    const loc = locationById(h, String(body.locationId ?? ''));
    if (!loc || loc.doctorId !== doctor.id || !loc.isActive) throw notFound('Location');
    const startAt = typeof body.startAt === 'string' && !Number.isNaN(Date.parse(body.startAt)) ? new Date(body.startAt).toISOString() : '';
    if (!startAt) throw bad('Choose a time.', { startAt: 'Choose a time' });

    const member = body.familyMemberId ? h.family.find(f => f.id === body.familyMemberId && f.userId === user.id) : null;
    if (body.familyMemberId && !member) throw bad('Choose who the appointment is for.', { familyMemberId: 'Not one of your family members' });
    const recordIds: string[] = Array.isArray(body.recordIds) ? body.recordIds.filter((id: string) => h.records.some(r => r.id === id && r.userId === user.id)) : [];
    const method: AppointmentPaymentMethod = body.paymentMethod === 'transfer' ? 'transfer' : 'pay_at_visit';
    if (loc.kind === 'clinic' && method !== 'pay_at_visit') throw bad('Clinic visits are paid at the clinic.', { paymentMethod: 'Pay at the clinic' });
    if (loc.kind === 'video' && loc.requiresPrepay && method !== 'transfer') {
      throw bad('This doctor asks for payment before video consultations.', { paymentMethod: 'Transfer before the consultation' });
    }
    const account = method === 'transfer' ? (h.paymentAccounts[doctor.id] ?? []).find(p => p.isActive) : null;
    if (method === 'transfer' && !account) throw new HealthError(422, 'NO_PAYMENT_ACCOUNT', 'This doctor has not added a payment account yet. Choose pay at the consultation.');

    const date = dateInZone(startAt, loc.timezone);
    const free = slotsFor(h, loc, date, now).some(s => s.startAt === startAt);
    // Mock mode's race: at Dr. Bilal's Gulberg clinic the first free time of
    // a day is always taken by another patient a moment before you confirm.
    // Once per day at that clinic, so picking an alternative then books it.
    const contestedKey = `${loc.id}|${date}`;
    const contested =
      free && loc.id === 'loc_bilal_2' && !h.contested.includes(contestedKey) && slotsFor(h, loc, date, now)[0]?.startAt === startAt;
    if (!free || contested) {
      if (contested) {
        h.contested.push(contestedKey);
        const ghost = newAppointment(h, {
          doctorId: doctor.id,
          loc,
          startAt,
          userId: 'u_standin_ghost',
          familyMemberId: null,
          patientName: 'Another patient',
          patientDob: null,
          patientGender: null,
          patientPhone: null,
          reasonTags: [],
          reason: null,
          recordIds: [],
          paymentMethod: 'pay_at_visit',
          now,
        });
        h.appointments.push(ghost);
        // Kept even though this request fails: the slot really is gone.
        throw Object.assign(
          new HealthError(409, 'SLOT_TAKEN', 'Someone booked this time a moment ago. Choose another time.', {
            alternatives: alternativesAfter(h, loc, startAt, now, 3),
          }),
          { keepChanges: true },
        );
      }
      throw new HealthError(409, 'SLOT_TAKEN', 'This time is no longer available. Choose another time.', {
        alternatives: alternativesAfter(h, loc, startAt, now, 3),
      });
    }

    const a = newAppointment(h, {
      doctorId: doctor.id,
      loc,
      startAt,
      userId: user.id,
      familyMemberId: member?.id ?? null,
      patientName: member?.name ?? user.name,
      patientDob: member?.dateOfBirth ?? user.dateOfBirth,
      patientGender: (member?.gender ?? (user.gender as MockAppointment['patientGender'])) || null,
      patientPhone: member?.phone ?? user.phone,
      reasonTags: (Array.isArray(body.reasonTags) ? body.reasonTags : []).filter((t: string) => ['follow_up', 'new_problem', 'reports_review'].includes(t)),
      reason: text(body.reason).slice(0, 300) || null,
      recordIds,
      paymentMethod: method,
      now,
    });
    if (method === 'transfer' && account) {
      a.instructions = {
        kind: account.kind,
        accountTitle: account.title,
        accountNumber: account.number,
        bankName: account.bankName,
        amount: loc.fee,
        payBy: new Date(Math.max(now + 10 * MINUTE, Math.min(now + PAY_WINDOW_MIN * MINUTE, Date.parse(startAt) - 15 * MINUTE))).toISOString(),
      };
    } else addEvent(a, 'confirmed', null, now);
    h.appointments.push(a);
    if (doctor.ownerId) {
      notifyHealth(db, doctor.ownerId, 'appointment_new', 'New appointment', `${a.patientName} booked ${loc.kind === 'video' ? 'a video consultation' : `a visit at ${loc.name}`}.`, {
        appointmentId: a.id,
      });
    }
    const payload = appointmentDetailView(h, a, now);
    ctx.setStatus(201);
    h.idempotency[`${user.id}|${key}`] = { status: 201, payload };
    return payload;
  });

  route('GET', '/healthcare/appointments', ctx => {
    const { db, now, query } = ctx;
    const h = db.health;
    const user = requireCustomer(ctx);
    if (user.id === 'u_customer') ensureDemoVideo(h, now);
    const mine = h.appointments.filter(a => a.userId === user.id);
    const upcoming = (a: MockAppointment) => isActive(a) && Date.parse(a.endAt) + 30 * MINUTE > now;
    const rows = query.segment === 'past' ? mine.filter(a => !upcoming(a)).sort(latestFirst) : mine.filter(upcoming).sort(upcomingFirst);
    return paginate(rows.map(a => appointmentSummaryView(h, a, now)), query);
  });

  route('GET', '/healthcare/appointments/:code', ctx => appointmentDetailView(ctx.db.health, myAppointment(ctx, requireCustomer(ctx)), ctx.now));

  route('POST', '/healthcare/appointments/:code/cancel', ctx => {
    const { db, now, body } = ctx;
    const h = db.health;
    const a = myAppointment(ctx, requireCustomer(ctx));
    if (!patientFlags(h, a, now).canCancel) throw transition('This appointment can no longer be cancelled.');
    const reason = text(body.reason);
    if (!reason) throw bad('Choose a reason.', { reason: 'Choose a reason' });
    a.lateCancel = isLateCancel(h, a, now);
    a.status = 'cancelled';
    a.cancelledBy = 'patient';
    const words: Record<string, string> = {
      feeling_better: 'Feeling better',
      schedule_clash: 'Schedule clash',
      booked_by_mistake: 'Booked by mistake',
      other_doctor: 'Seeing another doctor',
    };
    a.cancelReason = [words[reason] ?? null, text(body.note) || null].filter(Boolean).join(' — ') || 'Cancelled by the patient';
    addEvent(a, 'cancelled', a.lateCancel ? 'Late cancellation' : null, now);
    const d = doctorById(h, a.doctorId);
    if (d?.ownerId) notifyHealth(db, d.ownerId, 'appointment_update', 'Appointment cancelled', `${a.patientName} cancelled ${a.code}.`, { appointmentId: a.id });
    return appointmentDetailView(h, a, now);
  });

  route('POST', '/healthcare/appointments/:code/reschedule', ctx => {
    const { db, now, body } = ctx;
    const h = db.health;
    const a = myAppointment(ctx, requireCustomer(ctx));
    if (!patientFlags(h, a, now).canReschedule) throw transition('This appointment can no longer be rescheduled.');
    const loc = locationById(h, a.locationId)!;
    const startAt = typeof body.startAt === 'string' && !Number.isNaN(Date.parse(body.startAt)) ? new Date(body.startAt).toISOString() : '';
    if (!startAt) throw bad('Choose a new time.', { startAt: 'Choose a new time' });
    const free = slotsFor(h, loc, dateInZone(startAt, loc.timezone), now, a.id).some(s => s.startAt === startAt);
    if (!free) {
      throw new HealthError(409, 'SLOT_TAKEN', 'This time is no longer available. Choose another time.', {
        alternatives: alternativesAfter(h, loc, startAt, now, 3, a.id),
      });
    }
    const from = a.startAt;
    a.startAt = startAt;
    a.endAt = new Date(Date.parse(startAt) + loc.slotMinutes * MINUTE).toISOString();
    a.rescheduleCount += 1;
    addEvent(a, 'rescheduled', from, now);
    const d = doctorById(h, a.doctorId);
    if (d?.ownerId) notifyHealth(db, d.ownerId, 'appointment_update', 'Appointment moved', `${a.patientName} moved ${a.code} to a new time.`, { appointmentId: a.id });
    return appointmentDetailView(h, a, now);
  });

  route('POST', '/healthcare/appointments/:code/payment-proof', ctx => {
    const { db, now, body } = ctx;
    const h = db.health;
    const a = myAppointment(ctx, requireCustomer(ctx));
    if (!patientFlags(h, a, now).canPay) throw transition('No payment is due for this appointment.');
    const id = text(body.transactionId).toUpperCase().replace(/\s+/g, '');
    if (!/^[A-Z0-9-]{6,40}$/.test(id)) throw bad('Check the transaction ID.', { transactionId: 'Use 6 to 40 letters or digits' });
    a.proof = { transactionId: id, imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : null, submittedAt: isoNow(now), rejectionReason: null };
    a.paymentStatus = 'proof_submitted';
    addEvent(a, 'payment_proof_submitted', id, now);
    const d = doctorById(h, a.doctorId);
    if (d?.ownerId) notifyHealth(db, d.ownerId, 'appointment_payment', 'Payment to check', `${a.patientName} sent ${id} for ${a.code}.`, { appointmentId: a.id });
    return appointmentDetailView(h, a, now);
  });

  route('POST', '/healthcare/appointments/:code/records', ctx => {
    const { db, now, body } = ctx;
    const h = db.health;
    const user = requireCustomer(ctx);
    const a = myAppointment(ctx, user);
    if (!isActive(a)) throw transition('Records can be shared only before the visit ends.');
    const ids: string[] = (Array.isArray(body.recordIds) ? body.recordIds : []).filter((id: string) => h.records.some(r => r.id === id && r.userId === user.id));
    a.recordIds = [...new Set([...a.recordIds, ...ids])].slice(0, 10);
    return appointmentDetailView(h, a, now);
  });

  route('POST', '/healthcare/appointments/:code/review', ctx => {
    const { db, now, body } = ctx;
    const h = db.health;
    const user = requireCustomer(ctx);
    const a = myAppointment(ctx, user);
    if (a.reviewId) throw new HealthError(409, 'ALREADY_REVIEWED', 'You have already rated this visit.');
    if (a.status !== 'completed' || now - Date.parse(a.completedAt ?? a.endAt) > REVIEW_WINDOW_DAYS * DAY) {
      throw transition('Only completed visits from the last 30 days can be rated.');
    }
    const rating = Math.round(Number(body.rating));
    if (!(rating >= 1 && rating <= 5)) throw bad('Tap a star rating.', { rating: 'Tap a star rating' });
    const dims: Record<string, number> = {};
    for (const k of ['diagnosis', 'staff', 'environment']) {
      const v = Math.round(Number(body.dimensions?.[k]));
      if (v >= 1 && v <= 5 && (k === 'diagnosis' || a.kind === 'clinic')) dims[k] = v;
    }
    const review = {
      id: nextId(h, 'rv'),
      doctorId: a.doctorId,
      appointmentId: a.id,
      userId: user.id,
      authorName: user.name,
      anonymous: body.anonymous !== false,
      rating,
      recommend: body.recommend !== false,
      dimensions: dims,
      tags: (Array.isArray(body.tags) ? body.tags : []).map(text).filter(Boolean).slice(0, 8),
      text: text(body.text).slice(0, 1000) || null,
      kind: a.kind,
      waitMinutes: a.checkedInAt && a.startedAt ? Math.max(0, Math.round((Date.parse(a.startedAt) - Date.parse(a.checkedInAt)) / MINUTE)) : a.kind === 'video' ? 0 : null,
      createdAt: isoNow(now),
      reply: null,
      isHidden: false,
      hiddenReason: null,
    };
    h.reviews.push(review);
    a.reviewId = review.id;
    ctx.setStatus(201);
    return appointmentDetailView(h, a, now);
  });

  route('POST', '/healthcare/appointments/:code/video/join', ctx => {
    const { now } = ctx;
    const user = requireCustomer(ctx);
    const a = myAppointment(ctx, user);
    if (a.kind !== 'video') throw transition('This is a clinic visit.');
    if (!canJoin(a, now)) {
      throw new HealthError(403, 'VIDEO_NOT_OPEN', 'The consultation room opens 10 minutes before your time.', {
        opensAt: new Date(Date.parse(a.startAt) - 10 * MINUTE).toISOString(),
      });
    }
    return { provider: 'jitsi', roomUrl: roomUrl(a, a.patientName), jwt: null, displayName: a.patientName, closesAt: new Date(Date.parse(a.endAt) + 30 * MINUTE).toISOString() };
  });

  // ══ Family, records, prescriptions ═══════════════════
  const familyInput = (body: Record<string, any>) => {
    const fields: Record<string, string> = {};
    const name = text(body.name);
    if (name.length < 2) fields.name = 'Enter their full name';
    if (!['spouse', 'child', 'parent', 'sibling', 'other'].includes(body.relation)) fields.relation = 'Choose the relation';
    if (!['male', 'female', 'other'].includes(body.gender)) fields.gender = 'Choose the gender';
    if (!DATE.test(String(body.dateOfBirth ?? ''))) fields.dateOfBirth = 'Choose their date of birth';
    if (Object.keys(fields).length) throw bad('Check the details.', fields);
    return { name, relation: body.relation, gender: body.gender, dateOfBirth: String(body.dateOfBirth), phone: text(body.phone) || null };
  };

  const familyView = (m: MockHealth['family'][number]) => ({
    id: m.id,
    name: m.name,
    relation: m.relation,
    gender: m.gender,
    dateOfBirth: m.dateOfBirth,
    phone: m.phone,
  });
  route('GET', '/healthcare/family', ctx => {
    const user = requireCustomer(ctx);
    return ctx.db.health.family.filter(f => f.userId === user.id).map(familyView);
  });
  route('POST', '/healthcare/family', ctx => {
    const h = ctx.db.health;
    const user = requireCustomer(ctx);
    if (h.family.filter(f => f.userId === user.id).length >= 10) throw new HealthError(422, 'FAMILY_LIMIT', 'You can add up to 10 family members.');
    const m = { id: nextId(h, 'fm'), userId: user.id, ...familyInput(ctx.body) };
    h.family.push(m);
    ctx.setStatus(201);
    return familyView(m);
  });
  route('PATCH', '/healthcare/family/:id', ctx => {
    const h = ctx.db.health;
    const user = requireCustomer(ctx);
    const m = h.family.find(f => f.id === decodeURIComponent(ctx.params[0]) && f.userId === user.id);
    if (!m) throw notFound('Family member');
    Object.assign(m, familyInput({ ...m, ...ctx.body }));
    return familyView(m);
  });
  route('DELETE', '/healthcare/family/:id', ctx => {
    const h = ctx.db.health;
    const user = requireCustomer(ctx);
    const m = h.family.find(f => f.id === decodeURIComponent(ctx.params[0]) && f.userId === user.id);
    if (!m) throw notFound('Family member');
    if (h.appointments.some(a => a.familyMemberId === m.id && isActive(a))) {
      throw new HealthError(409, 'MEMBER_HAS_APPOINTMENTS', `${m.name} has an upcoming appointment. Cancel it first.`);
    }
    h.family = h.family.filter(f => f.id !== m.id);
    return { removed: true };
  });

  route('GET', '/healthcare/records', ctx => {
    const h = ctx.db.health;
    const user = requireCustomer(ctx);
    const member = ctx.query.memberId;
    const rows = h.records
      .filter(r => r.userId === user.id)
      .filter(r => !member || (member === 'self' ? r.memberId === null : r.memberId === member))
      .filter(r => !ctx.query.type || r.type === ctx.query.type)
      .sort((a, b) => b.recordedOn.localeCompare(a.recordedOn) || b.createdAt.localeCompare(a.createdAt))
      .map(r => recordView(h, r));
    return paginate(rows, ctx.query);
  });
  route('POST', '/healthcare/records', ctx => {
    const { db, now, body } = ctx;
    const h = db.health;
    const user = requireCustomer(ctx);
    const fields: Record<string, string> = {};
    const title = text(body.title);
    if (title.length < 2) fields.title = 'Give the record a title';
    if (!['lab_report', 'prescription', 'imaging', 'discharge', 'other'].includes(body.type)) fields.type = 'Choose a type';
    if (!DATE.test(String(body.recordedOn ?? ''))) fields.recordedOn = 'Choose the date on the record';
    const files = (Array.isArray(body.files) ? body.files : []).filter((f: any) => typeof f?.url === 'string').slice(0, 10);
    if (!files.length) fields.files = 'Add at least one page';
    if (body.memberId && !h.family.some(f => f.id === body.memberId && f.userId === user.id)) fields.memberId = 'Not one of your family members';
    if (Object.keys(fields).length) throw bad('Check the record.', fields);
    const r = {
      id: nextId(h, 'rec'),
      userId: user.id,
      memberId: body.memberId || null,
      title,
      type: body.type,
      recordedOn: String(body.recordedOn),
      files: files.map((f: any) => ({ url: f.url, mime: typeof f.mime === 'string' ? f.mime : 'image/jpeg' })),
      createdAt: isoNow(now),
    };
    h.records.push(r);
    ctx.setStatus(201);
    return recordView(h, r);
  });
  route('GET', '/healthcare/records/:id', ctx => {
    const h = ctx.db.health;
    const user = requireCustomer(ctx);
    const r = h.records.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.userId === user.id);
    if (!r) throw notFound('Record');
    return recordView(h, r);
  });
  route('DELETE', '/healthcare/records/:id', ctx => {
    const h = ctx.db.health;
    const user = requireCustomer(ctx);
    const r = h.records.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.userId === user.id);
    if (!r) throw notFound('Record');
    h.records = h.records.filter(x => x.id !== r.id);
    for (const a of h.appointments) a.recordIds = a.recordIds.filter(id => id !== r.id);
    return { removed: true };
  });

  route('GET', '/healthcare/prescriptions', ctx => {
    const h = ctx.db.health;
    const user = requireCustomer(ctx);
    const rows = h.prescriptions
      .map(p => ({ p, a: h.appointments.find(a => a.id === p.appointmentId) }))
      .filter(x => x.a?.userId === user.id)
      .sort((x, y) => y.p.issuedAt.localeCompare(x.p.issuedAt))
      .map(({ p, a }) => {
        const d = doctorById(h, p.doctorId);
        return {
          id: p.id,
          appointmentCode: a!.code,
          doctorName: d ? `${d.title} ${d.name}` : 'Doctor',
          specialtyName: specialtyBySlug(h, d?.specialtySlug ?? null)?.name ?? '',
          diagnosis: p.diagnosis,
          issuedAt: p.issuedAt,
          patientName: a!.patientName,
        };
      });
    return paginate(rows, ctx.query);
  });
  route('GET', '/healthcare/prescriptions/:id', ctx => {
    const h = ctx.db.health;
    const user = requireCustomer(ctx);
    const p = h.prescriptions.find(x => x.id === decodeURIComponent(ctx.params[0]));
    const a = p ? h.appointments.find(x => x.id === p.appointmentId) : null;
    if (!p || a?.userId !== user.id) throw notFound('Prescription');
    return prescriptionView(h, p);
  });

  route('POST', '/healthcare/symptoms/check', ctx => {
    requireCustomer(ctx);
    const t = text(ctx.body.text);
    if (t.length < 3) throw bad('Describe how you feel.', { text: 'Describe how you feel in a few words' });
    return checkSymptoms(ctx.db.health, t);
  });

  // ══ Doctor: profile and practice ═════════════════════
  route('GET', '/healthcare/doctor/profile', ctx => ownProfileView(ctx.db.health, myDoctor(ctx).doctor));

  route('PATCH', '/healthcare/doctor/profile', ctx => {
    const { doctor: d } = myDoctor(ctx);
    const b = ctx.body;
    const h = ctx.db.health;
    const fields: Record<string, string> = {};
    if (b.name !== undefined && text(b.name).length < 3) fields.name = 'Enter your full name';
    if (b.specialtySlug !== undefined && !specialtyBySlug(h, b.specialtySlug)) fields.specialtySlug = 'Choose your specialty';
    if (b.about !== undefined && String(b.about).length > 1200) fields.about = 'Keep it under 1,200 characters';
    if (Object.keys(fields).length) throw bad('Check your profile.', fields);
    for (const k of ['title', 'name', 'gender', 'photoUrl', 'specialtySlug', 'secondarySpecialtySlug', 'practisingSince', 'languages', 'about', 'qualifications', 'experience', 'services'] as const) {
      if (b[k] !== undefined) (d as any)[k] = typeof b[k] === 'string' ? b[k].trim() : b[k];
    }
    if (Array.isArray(b.conditionSlugs)) d.conditionSlugs = b.conditionSlugs.filter((s: string) => h.conditions.some(c => c.slug === s));
    if (b.bookingRules && typeof b.bookingRules === 'object') d.bookingRules = { ...d.bookingRules, ...b.bookingRules };
    if (b.bookingRules?.videoPrepay !== undefined) {
      for (const l of locationsOf(h, d.id)) if (l.kind === 'video') l.requiresPrepay = !!b.bookingRules.videoPrepay;
    }
    return ownProfileView(h, d);
  });

  route('GET', '/healthcare/doctor/profile/completeness', ctx => COMPLETENESS(ctx.db.health, myDoctor(ctx).doctor));

  route('POST', '/healthcare/doctor/profile/publish', ctx => {
    const { business, doctor } = myDoctor(ctx);
    const c = COMPLETENESS(ctx.db.health, doctor);
    if (c.percent < 100) {
      throw new HealthError(422, 'PROFILE_INCOMPLETE', 'Finish the checklist before patients can find you.', { missing: c.items.filter(i => !i.done).map(i => i.key) });
    }
    if (!business.pmdcVerified) throw new HealthError(422, 'PMDC_NOT_VERIFIED', 'MetroMatrix is still checking your PMDC registration.');
    doctor.isListed = true;
    business.isListed = true;
    return publicBusiness(business);
  });

  const locationInput = (body: Record<string, any>, d: MockDoctor, partial = false) => {
    const fields: Record<string, string> = {};
    const kind: ConsultKind = body.kind === 'video' ? 'video' : 'clinic';
    const out: Partial<MockLocation> = {};
    if (!partial || body.kind !== undefined) out.kind = kind;
    if (!partial || body.name !== undefined) {
      out.name = text(body.name);
      if (out.name.length < 2) fields.name = 'Enter a name';
    }
    if (!partial || body.area !== undefined) out.area = text(body.area);
    if (!partial || body.city !== undefined) out.city = text(body.city) || d.city;
    if (!partial || body.fee !== undefined) {
      out.fee = Math.round(Number(body.fee));
      if (!(out.fee >= 0 && out.fee <= 50000)) fields.fee = 'Enter the fee in rupees';
    }
    if (!partial || body.slotMinutes !== undefined) {
      out.slotMinutes = Math.round(Number(body.slotMinutes));
      if (![10, 15, 20, 30, 45, 60].includes(out.slotMinutes)) fields.slotMinutes = 'Choose a slot length';
    }
    for (const k of ['address', 'phone', 'instructions'] as const) if (!partial || body[k] !== undefined) (out as any)[k] = text(body[k]) || null;
    for (const k of ['lat', 'lng'] as const) if (!partial || body[k] !== undefined) (out as any)[k] = num(body[k]);
    if (!partial || body.requiresPrepay !== undefined) out.requiresPrepay = kind === 'video' && !!body.requiresPrepay;
    if (kind === 'clinic' && (!partial || body.area !== undefined) && (out.area ?? '').length < 2) fields.area = 'Enter the area';
    if (Object.keys(fields).length) throw bad('Check the location.', fields);
    return out;
  };

  route('GET', '/healthcare/doctor/locations', ctx => {
    const { doctor } = myDoctor(ctx);
    return locationsOf(ctx.db.health, doctor.id).map(l => doctorLocationView(ctx.db.health, l, ctx.now));
  });
  route('POST', '/healthcare/doctor/locations', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const input = locationInput(ctx.body, doctor);
    if (input.kind === 'video' && locationsOf(h, doctor.id).some(l => l.kind === 'video')) {
      throw new HealthError(409, 'VIDEO_EXISTS', 'You already offer video consultations. Edit that row instead.');
    }
    const loc: MockLocation = {
      id: nextId(h, 'loc'),
      doctorId: doctor.id,
      kind: 'clinic',
      name: '',
      area: '',
      city: doctor.city,
      address: null,
      lat: null,
      lng: null,
      phone: null,
      fee: 0,
      slotMinutes: 15,
      instructions: null,
      timezone: PKT,
      requiresPrepay: false,
      hours: [1, 2, 3, 4, 5, 6, 7].map(day => ({ day, ranges: [] })),
      isActive: true,
      ...input,
    };
    h.locations.push(loc);
    ctx.setStatus(201);
    return doctorLocationView(h, loc, ctx.now);
  });
  const ownLocation = (ctx: ShopCtx, d: MockDoctor) => {
    const l = locationById(ctx.db.health, decodeURIComponent(ctx.params[0]));
    if (!l || l.doctorId !== d.id || !l.isActive) throw notFound('Location');
    return l;
  };
  route('PATCH', '/healthcare/doctor/locations/:id', ctx => {
    const { doctor } = myDoctor(ctx);
    const l = ownLocation(ctx, doctor);
    Object.assign(l, locationInput({ kind: l.kind, ...ctx.body }, doctor, true));
    return doctorLocationView(ctx.db.health, l, ctx.now);
  });
  route('DELETE', '/healthcare/doctor/locations/:id', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const l = ownLocation(ctx, doctor);
    const booked = h.appointments.filter(a => a.locationId === l.id && isActive(a) && Date.parse(a.startAt) > ctx.now).length;
    if (booked) throw new HealthError(409, 'LOCATION_HAS_APPOINTMENTS', `${booked} upcoming ${booked === 1 ? 'appointment is' : 'appointments are'} booked here. Move or cancel them first.`);
    l.isActive = false;
    return { removed: true };
  });
  route('PUT', '/healthcare/doctor/locations/:id/hours', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const l = ownLocation(ctx, doctor);
    const hours = cleanWeek(ctx.body.hours);
    const fields = weekErrors(hours);
    if (Object.keys(fields).length) throw bad('Check the hours.', fields);
    const overlaps: { day: number; otherLocationName: string }[] = [];
    for (const d of hours) {
      for (const other of locationsOf(h, doctor.id)) {
        if (other.id === l.id) continue;
        const theirs = other.hours.find(x => x.day === d.day)?.ranges ?? [];
        const clash = d.ranges.some(r => theirs.some(t => toMin(r.from) < toMin(t.to) && toMin(t.from) < toMin(r.to)));
        if (clash && !overlaps.some(o => o.day === d.day && o.otherLocationName === other.name)) overlaps.push({ day: d.day, otherLocationName: other.name });
      }
    }
    if (overlaps.length) {
      const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const first = overlaps[0];
      throw bad(`These hours overlap your ${DAYS[first.day]} hours at ${first.otherLocationName}.`, { hours: `Overlaps ${first.otherLocationName}` }, { overlaps });
    }
    l.hours = hours;
    return doctorLocationView(h, l, ctx.now);
  });

  route('GET', '/healthcare/doctor/availability/preview', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const n = Math.min(14, Math.max(1, Math.round(num(ctx.query.days) ?? 7)));
    doctor.previewSeen = true;
    return {
      locations: locationsOf(h, doctor.id).map(l => {
        const today = todayInZone(l.timezone, ctx.now);
        return {
          id: l.id,
          name: l.name,
          kind: l.kind,
          timezone: l.timezone,
          days: Array.from({ length: n }, (_, i) => {
            const date = addDays(today, i);
            return { date, slots: slotsFor(h, l, date, ctx.now).map(s => s.startAt) };
          }),
        };
      }),
    };
  });

  route('GET', '/healthcare/doctor/time-off', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const today = todayInZone(PKT, ctx.now);
    return h.timeOff
      .filter(t => t.doctorId === doctor.id && t.to >= today)
      .sort((a, b) => a.from.localeCompare(b.from))
      .map(t => ({ ...t, locationName: t.locationId ? (locationById(h, t.locationId)?.name ?? null) : null }));
  });
  route('POST', '/healthcare/doctor/time-off', ctx => {
    const { db, now, body } = ctx;
    const { doctor } = myDoctor(ctx);
    const h = db.health;
    const today = todayInZone(PKT, now);
    const from = String(body.from ?? '');
    const to = String(body.to ?? '');
    const fields: Record<string, string> = {};
    if (!DATE.test(from) || from < today) fields.from = 'Choose today or a later day';
    if (!DATE.test(to) || to < from) fields.to = 'The last day is before the first';
    const locationId = body.locationId ? String(body.locationId) : null;
    if (locationId && !locationsOf(h, doctor.id).some(l => l.id === locationId)) fields.locationId = 'Choose one of your locations';
    if (Object.keys(fields).length) throw bad('Check the dates.', fields);
    const conflicts = h.appointments.filter(
      a =>
        a.doctorId === doctor.id &&
        isActive(a) &&
        Date.parse(a.startAt) > now &&
        (!locationId || a.locationId === locationId) &&
        dateInZone(a.startAt, PKT) >= from &&
        dateInZone(a.startAt, PKT) <= to,
    );
    if (conflicts.length && !bool(body.cancelConflicts)) {
      throw new HealthError(409, 'TIME_OFF_CONFLICT', `${conflicts.length} booked ${conflicts.length === 1 ? 'appointment falls' : 'appointments fall'} on these days.`, {
        appointments: conflicts
          .sort(upcomingFirst)
          .map(a => ({ id: a.id, code: a.code, startAt: a.startAt, timezone: PKT, patientName: a.patientName })),
      });
    }
    for (const a of conflicts) {
      a.status = 'cancelled';
      a.cancelledBy = 'doctor';
      a.cancelReason = 'The doctor is not available on this day.';
      addEvent(a, 'cancelled', a.cancelReason, now);
      notifyHealth(db, a.userId, 'appointment_update', 'Appointment cancelled', `${doctor.title} ${doctor.name} is not available on that day, so ${a.code} was cancelled. Please book another time.`, {
        appointmentCode: a.code,
      });
    }
    const t = { id: nextId(h, 'off'), doctorId: doctor.id, from, to, locationId, reason: text(body.reason) || null };
    h.timeOff.push(t);
    ctx.setStatus(201);
    return { ...t, locationName: locationId ? (locationById(h, locationId)?.name ?? null) : null };
  });
  route('DELETE', '/healthcare/doctor/time-off/:id', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const t = h.timeOff.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.doctorId === doctor.id);
    if (!t) throw notFound('Time off');
    h.timeOff = h.timeOff.filter(x => x.id !== t.id);
    return { removed: true };
  });

  // Payment accounts (same rules as a store's).
  const accountInput = (b: Record<string, any>) => {
    const kind = ['raast', 'jazzcash', 'easypaisa', 'bank'].includes(b.kind) ? b.kind : null;
    const fields: Record<string, string> = {};
    if (!kind) fields.kind = 'Choose an account type';
    if (text(b.title).length < 3) fields.title = 'Enter the account title';
    const number = text(b.number).replace(/\s/g, '').toUpperCase();
    if (kind === 'bank' ? !/^PK\d{2}[A-Z]{4}\d{16}$/.test(number) : !/^(\+92|0)3\d{9}$/.test(number)) {
      fields.number = kind === 'bank' ? 'Enter a 24-character PK IBAN' : 'Enter the mobile number on the account';
    }
    if (kind === 'bank' && text(b.bankName).length < 2) fields.bankName = 'Enter the bank name';
    if (Object.keys(fields).length) throw bad('Check the account.', fields);
    return { kind, title: text(b.title), number: number.startsWith('0') ? `+92${number.slice(1)}` : number, bankName: kind === 'bank' ? text(b.bankName) : null, isActive: b.isActive !== false };
  };
  route('GET', '/healthcare/doctor/payment-accounts', ctx => ctx.db.health.paymentAccounts[myDoctor(ctx).doctor.id] ?? []);
  route('POST', '/healthcare/doctor/payment-accounts', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const list = (h.paymentAccounts[doctor.id] ??= []);
    if (list.filter(a => a.isActive).length >= 4) throw new HealthError(422, 'ACCOUNT_LIMIT', 'You can keep up to 4 active accounts.');
    const acc = { id: nextId(h, 'pa'), ...accountInput(ctx.body) };
    list.push(acc);
    ctx.setStatus(201);
    return acc;
  });
  route('PATCH', '/healthcare/doctor/payment-accounts/:id', ctx => {
    const { doctor } = myDoctor(ctx);
    const acc = (ctx.db.health.paymentAccounts[doctor.id] ?? []).find(a => a.id === decodeURIComponent(ctx.params[0]));
    if (!acc) throw notFound('Account');
    Object.assign(acc, accountInput({ ...acc, ...ctx.body }));
    return acc;
  });
  route('DELETE', '/healthcare/doctor/payment-accounts/:id', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const before = (h.paymentAccounts[doctor.id] ?? []).length;
    h.paymentAccounts[doctor.id] = (h.paymentAccounts[doctor.id] ?? []).filter(a => a.id !== decodeURIComponent(ctx.params[0]));
    if (h.paymentAccounts[doctor.id].length === before) throw notFound('Account');
    return { removed: true };
  });

  // ══ Doctor: the day ══════════════════════════════════
  route('GET', '/healthcare/doctor/today', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    if (doctor.id === 'd_bilal') ensureDemoVideo(h, ctx.now);
    const date = DATE.test(String(ctx.query.date ?? '')) ? String(ctx.query.date) : todayInZone(PKT, ctx.now);
    const locationId = ctx.query.locationId ? String(ctx.query.locationId) : null;
    const day = h.appointments.filter(a => a.doctorId === doctor.id && a.status !== 'cancelled' && dateInZone(a.startAt, PKT) === date);
    const shown = day.filter(a => !locationId || a.locationId === locationId).sort(upcomingFirst);
    return {
      date,
      timezone: PKT,
      locations: locationsOf(h, doctor.id).map(l => ({ id: l.id, name: l.name, kind: l.kind })),
      counts: {
        booked: shown.length,
        checkedIn: shown.filter(a => a.status === 'checked_in' || a.status === 'in_progress').length,
        done: shown.filter(a => a.status === 'completed').length,
        noShow: shown.filter(a => a.status === 'no_show').length,
      },
      queue: shown.map(a => queueItemView(h, a, ctx.now)),
    };
  });

  route('GET', '/healthcare/doctor/calendar', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    if (doctor.id === 'd_bilal') ensureDemoVideo(h, ctx.now);
    const from = DATE.test(String(ctx.query.from ?? '')) ? String(ctx.query.from) : todayInZone(PKT, ctx.now);
    const to = DATE.test(String(ctx.query.to ?? '')) ? String(ctx.query.to) : addDays(from, 6);
    return {
      appointments: h.appointments
        .filter(a => a.doctorId === doctor.id && a.status !== 'cancelled' && dateInZone(a.startAt, PKT) >= from && dateInZone(a.startAt, PKT) <= to)
        .sort(upcomingFirst)
        .map(a => ({
          id: a.id,
          startAt: a.startAt,
          endAt: a.endAt,
          timezone: PKT,
          kind: a.kind,
          locationId: a.locationId,
          locationName: locationById(h, a.locationId)?.name ?? '',
          patientName: a.patientName,
          status: a.status,
        })),
      timeOff: h.timeOff
        .filter(t => t.doctorId === doctor.id && t.to >= from && t.from <= to)
        .map(t => ({ ...t, locationName: t.locationId ? (locationById(h, t.locationId)?.name ?? null) : null })),
      locations: locationsOf(h, doctor.id).map(l => ({ id: l.id, name: l.name, kind: l.kind })),
    };
  });

  route('GET', '/healthcare/doctor/appointments/:id', ctx => {
    const { doctor } = myDoctor(ctx);
    return doctorAppointmentView(ctx.db.health, doctorAppointment(ctx, doctor), ctx.now);
  });

  const act = (pattern: string, run: (ctx: ShopCtx, a: MockAppointment, doctor: MockDoctor) => void) =>
    route('POST', `/healthcare/doctor/appointments/:id/${pattern}`, ctx => {
      const { doctor } = myDoctor(ctx);
      const a = doctorAppointment(ctx, doctor);
      run(ctx, a, doctor);
      return doctorAppointmentView(ctx.db.health, a, ctx.now);
    });

  act('check-in', (ctx, a) => {
    if (!doctorActions(ctx.db.health, a, ctx.now).canCheckIn) throw transition('This patient can not be checked in now.');
    a.status = 'checked_in';
    a.checkedInAt = isoNow(ctx.now);
    addEvent(a, 'checked_in', null, ctx.now);
  });
  act('start', (ctx, a) => {
    if (!doctorActions(ctx.db.health, a, ctx.now).canStart) throw transition('This consultation can not start now.');
    a.status = 'in_progress';
    a.startedAt = isoNow(ctx.now);
    if (a.kind === 'video' && !a.checkedInAt) a.checkedInAt = a.startedAt;
    addEvent(a, 'in_progress', null, ctx.now);
  });
  act('no-show', (ctx, a) => {
    if (!doctorActions(ctx.db.health, a, ctx.now).canNoShow) throw transition('This appointment can not be marked as missed yet.');
    a.status = 'no_show';
    addEvent(a, 'no_show', null, ctx.now);
    notifyHealth(ctx.db, a.userId, 'appointment_update', 'Marked as missed', `Your appointment ${a.code} was marked as missed. You can book another time.`, {
      appointmentCode: a.code,
    });
  });
  act('complete', (ctx, a, doctor) => {
    if (!doctorActions(ctx.db.health, a, ctx.now).canComplete) throw transition('Start the consultation before completing it.');
    a.status = 'completed';
    a.completedAt = isoNow(ctx.now);
    if (a.paymentMethod === 'pay_at_visit' && bool(ctx.body.paymentCollected)) a.paymentStatus = 'collected';
    addEvent(a, 'completed', null, ctx.now);
    notifyHealth(ctx.db, a.userId, 'appointment_update', 'Visit complete', `Your visit with ${doctor.title} ${doctor.name} is complete. You can rate it from the appointment.`, {
      appointmentCode: a.code,
    });
  });
  act('cancel', (ctx, a, doctor) => {
    if (!doctorActions(ctx.db.health, a, ctx.now).canCancel) throw transition('This appointment can no longer be cancelled.');
    const reason = text(ctx.body.reason);
    if (reason.length < 3) throw bad('Tell the patient why.', { reason: 'Tell the patient why' });
    a.status = 'cancelled';
    a.cancelledBy = 'doctor';
    a.cancelReason = reason;
    addEvent(a, 'cancelled', reason, ctx.now);
    notifyHealth(ctx.db, a.userId, 'appointment_update', 'Appointment cancelled', `${doctor.title} ${doctor.name} cancelled ${a.code}: ${reason}`, { appointmentCode: a.code });
  });
  act('payment/confirm', (ctx, a) => {
    if (a.paymentStatus !== 'proof_submitted') throw transition('There is no payment to confirm.');
    a.paymentStatus = 'paid';
    addEvent(a, 'payment_confirmed', null, ctx.now);
    if (a.status === 'awaiting_payment') {
      a.status = 'confirmed';
      addEvent(a, 'confirmed', null, ctx.now);
    }
    notifyHealth(ctx.db, a.userId, 'appointment_update', 'Payment confirmed', `Your appointment ${a.code} is confirmed.`, { appointmentCode: a.code });
  });
  act('payment/reject', (ctx, a) => {
    if (a.paymentStatus !== 'proof_submitted' || !a.proof) throw transition('There is no payment to check.');
    const reason = text(ctx.body.reason);
    if (reason.length < 3) throw bad('Tell the patient what was wrong.', { reason: 'Tell the patient what was wrong' });
    a.paymentStatus = 'proof_rejected';
    a.proof = { ...a.proof, rejectionReason: reason };
    if (a.instructions) a.instructions.payBy = new Date(Math.max(Date.parse(a.instructions.payBy), ctx.now + 60 * MINUTE)).toISOString();
    addEvent(a, 'payment_rejected', reason, ctx.now);
    notifyHealth(ctx.db, a.userId, 'appointment_update', 'Payment not found', `The doctor could not find your payment for ${a.code}: ${reason}`, { appointmentCode: a.code });
  });
  route('PUT', '/healthcare/doctor/appointments/:id/notes', ctx => {
    const { doctor } = myDoctor(ctx);
    const a = doctorAppointment(ctx, doctor);
    const t = typeof ctx.body.text === 'string' ? ctx.body.text : '';
    if (t.length > 4000) throw bad('Keep notes under 4,000 characters.', { text: 'Keep notes under 4,000 characters' });
    a.notes = {
      text: t,
      attachments: (Array.isArray(ctx.body.attachments) ? ctx.body.attachments : []).filter((u: unknown) => typeof u === 'string').slice(0, 10),
      updatedAt: isoNow(ctx.now),
    };
    return doctorAppointmentView(ctx.db.health, a, ctx.now);
  });
  route('POST', '/healthcare/doctor/appointments/:id/video/join', ctx => {
    const { doctor } = myDoctor(ctx);
    const a = doctorAppointment(ctx, doctor);
    if (!canJoin(a, ctx.now)) {
      throw new HealthError(403, 'VIDEO_NOT_OPEN', 'The consultation room opens 10 minutes before the time.', {
        opensAt: new Date(Date.parse(a.startAt) - 10 * MINUTE).toISOString(),
      });
    }
    const name = `${doctor.title} ${doctor.name}`;
    return { provider: 'jitsi', roomUrl: roomUrl(a, name), jwt: null, displayName: name, closesAt: new Date(Date.parse(a.endAt) + 30 * MINUTE).toISOString() };
  });

  // ══ Doctor: prescriptions ════════════════════════════
  route('POST', '/healthcare/doctor/appointments/:id/prescription', ctx => {
    const { db, now } = ctx;
    const { doctor } = myDoctor(ctx);
    const h = db.health;
    const a = doctorAppointment(ctx, doctor);
    if (a.prescriptionId) throw new HealthError(409, 'PRESCRIPTION_EXISTS', 'This visit already has a prescription. Edit it instead.');
    if (a.status !== 'in_progress' && a.status !== 'completed') throw transition('Start the consultation before writing a prescription.');
    const p = { id: nextId(h, 'rx'), appointmentId: a.id, doctorId: doctor.id, issuedAt: isoNow(now), ...validatePrescription(ctx.body) };
    h.prescriptions.push(p);
    a.prescriptionId = p.id;
    addEvent(a, 'prescription_issued', null, now);
    notifyHealth(db, a.userId, 'prescription_ready', 'Your prescription is ready', `${doctor.title} ${doctor.name} wrote a prescription for ${a.patientName}.`, {
      prescriptionId: p.id,
      appointmentCode: a.code,
    });
    ctx.setStatus(201);
    return prescriptionView(h, p);
  });
  route('PATCH', '/healthcare/doctor/prescriptions/:id', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const p = h.prescriptions.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.doctorId === doctor.id);
    if (!p) throw notFound('Prescription');
    if (ctx.now > Date.parse(p.issuedAt) + PRESCRIPTION_EDIT_HOURS * HOUR) {
      throw new HealthError(409, 'PRESCRIPTION_LOCKED', 'Prescriptions can be changed for 24 hours after they are written. Write a new one at the next visit.');
    }
    Object.assign(p, validatePrescription(ctx.body));
    return prescriptionView(h, p);
  });
  route('GET', '/healthcare/doctor/medicines/suggest', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const q = text(ctx.query.q);
    const fav = (h.favourites[doctor.id] ?? []).filter(m => !q || matches(q, m.name));
    const rest = h.formulary.filter(m => (!q ? false : matches(q, m.name)) && !fav.some(f => f.name === m.name && f.strength === m.strength));
    return [...fav.map(m => ({ ...m, isFavourite: true })), ...rest.map(m => ({ ...m, isFavourite: false }))].slice(0, 12);
  });
  route('GET', '/healthcare/doctor/diagnoses/recent', ctx => {
    const { doctor } = myDoctor(ctx);
    const seen: string[] = [];
    for (const p of [...ctx.db.health.prescriptions].filter(x => x.doctorId === doctor.id).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))) {
      if (!seen.includes(p.diagnosis)) seen.push(p.diagnosis);
    }
    return seen.slice(0, 8);
  });

  // ══ Doctor: patients, reviews, insights ══════════════
  route('GET', '/healthcare/doctor/patients', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const q = text(ctx.query.q);
    const groups = new Map<string, MockAppointment[]>();
    for (const a of h.appointments) {
      if (a.doctorId !== doctor.id || a.status === 'cancelled' || a.userId === 'u_standin_ghost') continue;
      const key = patientKey(a);
      groups.set(key, [...(groups.get(key) ?? []), a]);
    }
    const rows = [...groups.entries()]
      .map(([id, list]) => {
        const latest = [...list].sort(latestFirst)[0];
        const done = list.filter(a => a.status === 'completed').sort(latestFirst);
        return {
          id,
          name: latest.patientName,
          age: ageFrom(latest.patientDob, ctx.now),
          gender: latest.patientGender,
          lastVisitAt: (done[0] ?? latest).startAt,
          visits: done.length,
        };
      })
      .filter(p => !q || matches(q, p.name))
      .sort((a, b) => b.lastVisitAt.localeCompare(a.lastVisitAt));
    return paginate(rows, ctx.query);
  });
  route('GET', '/healthcare/doctor/patients/:id/history', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const key = decodeURIComponent(ctx.params[0]);
    const theirs = h.appointments.filter(a => a.doctorId === doctor.id && patientKey(a) === key).sort(latestFirst);
    if (!theirs.length) throw notFound('Patient');
    const latest = theirs[0];
    return {
      patient: { id: key, name: latest.patientName, age: ageFrom(latest.patientDob, ctx.now), gender: latest.patientGender },
      visits: previousVisitsOf(h, latest),
    };
  });

  route('GET', '/healthcare/doctor/reviews', ctx => {
    const { doctor } = myDoctor(ctx);
    const rows = visibleReviews(ctx.db.health, doctor.id)
      .filter(r => !bool(ctx.query.unreplied) || !r.reply)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(r => reviewView(r, ctx.now, true));
    return paginate(rows, ctx.query);
  });
  route('GET', '/healthcare/doctor/reviews/summary', ctx => reviewSummaryView(ctx.db.health, myDoctor(ctx).doctor.id));
  route('POST', '/healthcare/doctor/reviews/:id/reply', ctx => {
    const { doctor } = myDoctor(ctx);
    const r = ctx.db.health.reviews.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.doctorId === doctor.id && !x.isHidden);
    if (!r) throw notFound('Review');
    const t = text(ctx.body.text);
    if (t.length < 2 || t.length > 600) throw bad('Write a reply.', { reply: 'Write a reply of up to 600 characters' });
    if (r.reply && ctx.now > Date.parse(r.reply.createdAt) + REPLY_EDIT_HOURS * HOUR) {
      throw new HealthError(409, 'REPLY_LOCKED', 'A reply can be edited for 24 hours after it is posted.');
    }
    r.reply = { text: t, createdAt: r.reply?.createdAt ?? isoNow(ctx.now) };
    return reviewView(r, ctx.now, true);
  });

  route('GET', '/healthcare/doctor/insights', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const range = ['7d', '30d', '90d'].includes(ctx.query.range) ? String(ctx.query.range) : '30d';
    const n = Number(range.replace('d', ''));
    const today = todayInZone(PKT, ctx.now);
    const from = addDays(today, -(n - 1));
    const inRange = h.appointments.filter(a => a.doctorId === doctor.id && a.userId !== 'u_standin_ghost' && pkDay(a.startAt) >= from && pkDay(a.startAt) <= today);
    const perDay = Array.from({ length: n }, (_, i) => {
      const date = addDays(from, i);
      const day = inRange.filter(a => pkDay(a.startAt) === date && a.status !== 'cancelled');
      return { date, video: day.filter(a => a.kind === 'video').length, clinic: day.filter(a => a.kind === 'clinic').length };
    });
    const waits = inRange
      .filter(a => a.status === 'completed' && a.kind === 'clinic' && a.checkedInAt && a.startedAt)
      .map(a => (Date.parse(a.startedAt!) - Date.parse(a.checkedInAt!)) / MINUTE);
    const buckets = Math.max(1, Math.ceil(n / 7));
    const reviews = visibleReviews(h, doctor.id);
    const ratingTrend = Array.from({ length: buckets }, (_, i) => {
      const end = addDays(from, Math.min(n - 1, (i + 1) * 7 - 1));
      const upto = reviews.filter(r => pkDay(r.createdAt) <= end);
      return upto.length ? { date: end, rating: Math.round((upto.reduce((s, r) => s + r.rating, 0) / upto.length) * 10) / 10 } : null;
    }).filter(Boolean);
    return {
      range,
      perDay,
      outcomes: {
        completed: inRange.filter(a => a.status === 'completed').length,
        cancelled: inRange.filter(a => a.status === 'cancelled').length,
        noShow: inRange.filter(a => a.status === 'no_show').length,
      },
      avgWaitMinutes: waits.length >= 3 ? Math.round(waits.reduce((s, w) => s + w, 0) / waits.length) : null,
      ratingTrend,
      recordedFees: inRange.filter(a => a.status === 'completed' && (a.paymentStatus === 'collected' || a.paymentStatus === 'paid')).reduce((s, a) => s + a.fee, 0),
      appointments: inRange.filter(a => a.status !== 'cancelled').length,
    };
  });

  // ══ Admin ════════════════════════════════════════════
  route('GET', '/admin/healthcare/overview', ctx => {
    requireAdmin(ctx);
    const h = ctx.db.health;
    const today = todayInZone(PKT, ctx.now);
    const listed = h.doctors.filter(d => d.isListed);
    const by = new Map<string, number>();
    for (const d of listed) {
      const name = specialtyBySlug(h, d.specialtySlug)?.name ?? 'Other';
      by.set(name, (by.get(name) ?? 0) + 1);
    }
    const events = h.appointments.flatMap(a => a.events.map(e => ({ ...e })));
    return {
      listedDoctors: listed.length,
      bySpecialty: [...by.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
      bookingsToday: h.appointments.filter(a => pkDay(a.createdAt) === today && a.userId !== 'u_standin_ghost').length,
      cancelledToday: events.filter(e => e.type === 'cancelled' && pkDay(e.createdAt) === today).length,
      noShowsToday: events.filter(e => e.type === 'no_show' && pkDay(e.createdAt) === today).length,
      pendingVerification: ctx.db.businesses.filter(b => b.subType === 'doctor' && b.status === 'pending_approval' && !b.pmdcVerified).length,
    };
  });

  const specialtyInput = (b: Record<string, any>) => {
    const fields: Record<string, string> = {};
    if (text(b.name).length < 3) fields.name = 'Enter the name';
    if (!text(b.icon)) fields.icon = 'Choose an icon';
    if (Object.keys(fields).length) throw bad('Check the specialty.', fields);
    return { name: text(b.name), nameUr: text(b.nameUr), icon: text(b.icon), sort: Math.round(Number(b.sort) || 99) };
  };
  route('GET', '/admin/healthcare/specialties', ctx => {
    requireAdmin(ctx);
    const h = ctx.db.health;
    return [...h.specialties].sort((a, b) => a.sort - b.sort).map(s => ({ ...specialtyView(h, s.slug, null), sort: s.sort }));
  });
  route('POST', '/admin/healthcare/specialties', ctx => {
    requireAdmin(ctx);
    const h = ctx.db.health;
    const input = specialtyInput(ctx.body);
    const slug = slugify(input.name);
    if (h.specialties.some(s => s.slug === slug)) throw new HealthError(409, 'SPECIALTY_EXISTS', 'A specialty with this name exists.');
    const s = { id: `sp_${slug}`, slug, ...input };
    h.specialties.push(s);
    ctx.setStatus(201);
    return { ...specialtyView(h, slug, null), sort: s.sort };
  });
  route('PATCH', '/admin/healthcare/specialties/:id', ctx => {
    requireAdmin(ctx);
    const h = ctx.db.health;
    const s = h.specialties.find(x => x.id === decodeURIComponent(ctx.params[0]));
    if (!s) throw notFound('Specialty');
    Object.assign(s, specialtyInput({ ...s, ...ctx.body }));
    return { ...specialtyView(h, s.slug, null), sort: s.sort };
  });
  route('DELETE', '/admin/healthcare/specialties/:id', ctx => {
    requireAdmin(ctx);
    const h = ctx.db.health;
    const s = h.specialties.find(x => x.id === decodeURIComponent(ctx.params[0]));
    if (!s) throw notFound('Specialty');
    if (h.doctors.some(d => d.specialtySlug === s.slug || d.secondarySpecialtySlug === s.slug)) {
      throw new HealthError(409, 'SPECIALTY_IN_USE', 'Doctors are listed under this specialty. Move them first.');
    }
    h.specialties = h.specialties.filter(x => x.id !== s.id);
    return { removed: true };
  });

  const conditionInput = (b: Record<string, any>, h: MockHealth) => {
    const fields: Record<string, string> = {};
    if (text(b.name).length < 2) fields.name = 'Enter the condition';
    if (b.specialtySlug && !specialtyBySlug(h, b.specialtySlug)) fields.specialtySlug = 'Choose a specialty';
    if (Object.keys(fields).length) throw bad('Check the condition.', fields);
    return {
      name: text(b.name),
      nameUr: text(b.nameUr) || null,
      specialtySlug: b.specialtySlug || null,
      isCommon: !!b.isCommon,
      aliases: (Array.isArray(b.aliases) ? b.aliases : []).map(text).filter(Boolean).slice(0, 12),
    };
  };
  route('GET', '/admin/healthcare/conditions', ctx => {
    requireAdmin(ctx);
    const q = text(ctx.query.q);
    return ctx.db.health.conditions.filter(c => !q || matches(q, c.name, c.nameUr, ...c.aliases)).sort((a, b) => a.name.localeCompare(b.name));
  });
  route('POST', '/admin/healthcare/conditions', ctx => {
    requireAdmin(ctx);
    const h = ctx.db.health;
    const input = conditionInput(ctx.body, h);
    const slug = slugify(input.name);
    if (h.conditions.some(c => c.slug === slug)) throw new HealthError(409, 'CONDITION_EXISTS', 'This condition exists.');
    const c = { id: `cn_${slug}`, slug, icon: null, ...input };
    h.conditions.push(c);
    ctx.setStatus(201);
    return c;
  });
  route('PATCH', '/admin/healthcare/conditions/:id', ctx => {
    requireAdmin(ctx);
    const h = ctx.db.health;
    const c = h.conditions.find(x => x.id === decodeURIComponent(ctx.params[0]));
    if (!c) throw notFound('Condition');
    Object.assign(c, conditionInput({ ...c, ...ctx.body }, h));
    return c;
  });
  route('DELETE', '/admin/healthcare/conditions/:id', ctx => {
    requireAdmin(ctx);
    const h = ctx.db.health;
    const c = h.conditions.find(x => x.id === decodeURIComponent(ctx.params[0]));
    if (!c) throw notFound('Condition');
    h.conditions = h.conditions.filter(x => x.id !== c.id);
    for (const d of h.doctors) d.conditionSlugs = d.conditionSlugs.filter(s => s !== c.slug);
    return { removed: true };
  });

  const adminDoctorView = (db: MockDb, b: MockBusiness) => {
    const p = db.health.pmdc[b.id];
    return {
      businessId: b.id,
      name: db.users.find(u => u.id === b.ownerId)?.name ?? b.name,
      specialty: b.details?.specialty ?? '',
      city: b.city,
      pmdcNumber: b.details?.pmdcNumber ?? '',
      pmdcVerified: !!b.pmdcVerified,
      pmdcNote: p?.note ?? null,
      pmdcVerifiedAt: p?.at ?? null,
      status: b.status,
      submittedAt: b.submittedAt,
      documents: b.documents.map(d => ({ id: d.id, kind: d.kind, url: d.url, mimeType: d.mimeType })),
    };
  };
  route('GET', '/admin/healthcare/doctors', ctx => {
    requireAdmin(ctx);
    return ctx.db.businesses
      .filter(b => b.subType === 'doctor' && (ctx.query.status !== 'pending' || b.status === 'pending_approval'))
      .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))
      .map(b => adminDoctorView(ctx.db, b));
  });
  route('POST', '/admin/healthcare/doctors/:id/pmdc-verify', ctx => {
    requireAdmin(ctx);
    const b = ctx.db.businesses.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.subType === 'doctor');
    if (!b) throw notFound('Doctor');
    const note = text(ctx.body.note);
    if (note.length < 3) throw bad('Add a note.', { note: 'Say how you checked it, e.g. "Matched on the PMDC register"' });
    b.pmdcVerified = true;
    ctx.db.health.pmdc[b.id] = { verified: true, note, at: isoNow(ctx.now) };
    return adminDoctorView(ctx.db, b);
  });

  route('GET', '/admin/healthcare/reviews', ctx => {
    requireAdmin(ctx);
    const h = ctx.db.health;
    const hidden = ctx.query.hidden === undefined ? null : bool(ctx.query.hidden);
    const rows = h.reviews
      .filter(r => hidden === null || r.isHidden === hidden)
      .filter(r => r.text || r.isHidden)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(r => {
        const d = doctorById(h, r.doctorId);
        return { ...reviewView(r, ctx.now), authorName: r.authorName, doctorName: d ? `${d.title} ${d.name}` : null };
      });
    return paginate(rows, ctx.query);
  });
  const moderate = (hide: boolean) => (ctx: ShopCtx) => {
    requireAdmin(ctx);
    const h = ctx.db.health;
    const r = h.reviews.find(x => x.id === decodeURIComponent(ctx.params[0]));
    if (!r) throw notFound('Review');
    if (hide && text(ctx.body.reason).length < 3) throw bad('Give a reason.', { reason: 'Give a reason' });
    r.isHidden = hide;
    r.hiddenReason = hide ? text(ctx.body.reason) : null;
    const d = doctorById(h, r.doctorId);
    return { ...reviewView(r, ctx.now), authorName: r.authorName, doctorName: d ? `${d.title} ${d.name}` : null };
  };
  route('POST', '/admin/healthcare/reviews/:id/hide', moderate(true));
  route('POST', '/admin/healthcare/reviews/:id/unhide', moderate(false));

  route('GET', '/admin/healthcare/appointments/:code', ctx => {
    requireAdmin(ctx);
    const h = ctx.db.health;
    const a = h.appointments.find(x => x.code === decodeURIComponent(ctx.params[0]).toUpperCase());
    if (!a) throw notFound('Appointment');
    return { ...appointmentDetailView(h, a, ctx.now), doctorBusinessId: doctorById(h, a.doctorId)?.businessId ?? '' };
  });
}
