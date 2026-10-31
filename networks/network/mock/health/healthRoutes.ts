// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy Health routes (MetroMatrix-API docs/API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// Discovery and the patient under /health, the doctor under /health/doctor
// (appointments by CODE), staff under /admin/health. Bodies, statuses,
// error codes and shapes are the real API's (healthWire); the rules behind
// them are healthLogic's. Writes are all-or-nothing, like the shop's.

import type { MockBusiness, MockDb, MockUser } from '../mockDb';
import type { ShopCtx, ShopKit } from '../shop/shopRoutes';
import type { MockAppointment, MockDoctor, MockHealth, MockHealthBanner, MockLocation } from './healthTypes';
import type { AppointmentPaymentMethod, ConsultKind, Medicine, MedicineForm, ReasonTag, RecordType, WeekDayHours } from '../../../../models/health';
import { PKT, addDays, ageFrom, dateInZone, todayInZone } from '../../../../utils/health-time/healthTime';
import { appDayFromWeekday } from '../../../../models/health/availabilityModel';
import { REVIEW_TAG_CODES, reviewTagLabel } from '../../../../models/health/reviewFormModel';
import { recordTypeIn } from '../../../../serializers/health/healthCommon';
import {
  DAY,
  DISCLAIMER,
  EMERGENCY_MESSAGE,
  EMERGENCY_NUMBERS,
  HOUR,
  HealthError,
  MINUTE,
  PAY_WINDOW_MIN,
  REVIEW_WINDOW_DAYS,
  addEvent,
  alternativesAfter,
  appointmentCode,
  canJoin,
  cancelCutoff,
  checkSymptoms,
  doctorActions,
  doctorById,
  doctorOfOwner,
  earliestOf,
  isActive,
  isLateCancel,
  isoNow,
  locationById,
  locationsOf,
  nextId,
  notifyHealth,
  patientFlags,
  patientKey,
  roomUrl,
  servesCity,
  settleAppointments,
  slotsFor,
  specialtyBySlug,
  visibleReviews,
} from './healthLogic';
import {
  adminAppointmentWire,
  cardWire,
  completenessWire,
  conditionWire,
  displayName,
  doctorAppointmentWire,
  doctorLocationWire,
  familyWire,
  iconKey,
  notesWire,
  ownProfileWire,
  patientAppointmentWire,
  prescriptionOpen,
  prescriptionWire,
  profileWire,
  recordWire,
  reviewWire,
  scheduleWire,
  slotsWire,
  specialtyRefWire,
  specialtyWire,
  summaryWire,
  videoJoinWire,
  videoWindow,
  zoned,
} from './healthWire';

export interface HealthKit extends ShopKit {
  /** The business as the API sends it (session payloads). */
  publicBusiness: (b: MockBusiness) => unknown;
}

const bad = (message: string, fields: Record<string, string>, extra: Record<string, unknown> = {}) =>
  new HealthError(400, 'VALIDATION_FAILED', message, {
    fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, [v]])),
    ...extra,
  });
const notFound = (what: string) => new HealthError(404, 'NOT_FOUND', `${what} not found.`);
const notListed = () => new HealthError(404, 'DOCTOR_NOT_LISTED', 'This doctor is not taking bookings on MetroMatrix.');
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
const HHMM = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const instantOf = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : '');

const norm = (s: string) => s.toLowerCase().normalize('NFKC').trim();
const matches = (q: string, ...hay: (string | null | undefined)[]) => {
  const n = norm(q);
  return !!n && hay.some(h => h && norm(h).includes(n));
};

/** Retired by staff: gone from patients' lists. */
const live = (x: { isActive?: boolean }) => x.isActive !== false;

const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The Pakistan-day date of an ISO instant (dashboards, "today"). */
const pkDay = (iso: string) => dateInZone(iso, PKT);

const upcomingFirst = (a: MockAppointment, b: MockAppointment) => a.startAt.localeCompare(b.startAt);
const latestFirst = (a: MockAppointment, b: MockAppointment) => b.startAt.localeCompare(a.startAt);

const REASON_TAGS: ReasonTag[] = ['follow_up', 'new_problem', 'reports_review'];
const RECORD_TYPES = ['lab_report', 'prescription', 'scan', 'discharge_summary', 'other'];
const FORMS: MedicineForm[] = ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'other'];
const TIMINGS = ['before_meal', 'after_meal', 'with_meal', 'bedtime', 'as_needed'];
const TITLE_LABEL: Record<string, string> = { dr: 'Dr.', prof: 'Prof. Dr.', assoc_prof: 'Assoc. Prof. Dr.', asst_prof: 'Asst. Prof. Dr.' };

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
    paymentMethod: 'transfer',
    now,
  });
  // The demo consultation is already paid, so it can be joined straight away.
  a.status = 'confirmed';
  a.paymentStatus = 'paid';
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
  // A prepaid video is held until the transfer arrives; everything else is booked.
  status: o.paymentMethod === 'transfer' && o.loc.requiresPrepay ? 'awaiting_payment' : 'confirmed',
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
  rescheduledFromId: null,
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

/** `[{ weekday 0–6, start, end }]` → the dummy database's Monday-first week; within-day rules checked. */
const weekFromBody = (raw: unknown): WeekDayHours[] => {
  const week: WeekDayHours[] = [1, 2, 3, 4, 5, 6, 7].map(day => ({ day, ranges: [] }));
  const fields: Record<string, string> = {};
  (Array.isArray(raw) ? raw : []).forEach((r: any, i: number) => {
    const day = appDayFromWeekday(Number(r?.weekday));
    const from = String(r?.start ?? '');
    const to = String(r?.end ?? '');
    if (!day) fields[`${i}.weekday`] = 'weekday is 0 (Sunday) to 6 (Saturday)';
    else if (!HHMM.test(from) || !HHMM.test(to) || toMin(to) - toMin(from) < 15) fields[`${i}.end`] = 'At least 15 minutes, ending after it starts';
    else week[day - 1].ranges.push({ from, to });
  });
  for (const d of week) {
    d.ranges.sort((a, b) => toMin(a.from) - toMin(b.from));
    d.ranges.forEach((r, i) => {
      if (i && toMin(r.from) < toMin(d.ranges[i - 1].to)) fields[`day.${d.day}`] = 'Two ranges overlap on this day';
    });
  }
  if (Object.keys(fields).length) throw bad('Check the hours.', fields);
  return week;
};

const DOSE = /^(\d+(\.5)?|½)\+(\d+(\.5)?|½)\+(\d+(\.5)?|½)$/;

/** The prescription body (§4.3) → the dummy database's rows. */
const prescriptionFromBody = (body: Record<string, any>) => {
  const diagnosis = text(body.diagnosis);
  const medicines: Medicine[] = (Array.isArray(body.medicines) ? body.medicines : [])
    .filter((m: any) => text(m?.name))
    .map((m: any) => ({
      name: text(m.name),
      strength: text(m.strength),
      form: FORMS.includes(m.form) ? m.form : 'tablet',
      dose: String(m.dosePattern ?? '').replace(/\s/g, ''),
      timing: TIMINGS.includes(m.timing) ? m.timing : null,
      days: Math.round(Number(m.durationDays) || 0),
      instructions: text(m.instructions) || null,
    }));
  const tests: string[] = (Array.isArray(body.tests) ? body.tests : []).map((t: any) => text(t?.name ?? t)).filter(Boolean);
  const advice = text(body.advice) || null;
  const follow = num(body.followUpInDays);
  const fields: Record<string, string> = {};
  if (diagnosis.length < 2) fields.diagnosis = 'Enter the diagnosis';
  medicines.forEach((m, i) => {
    if (!DOSE.test(m.dose)) fields[`medicines.${i}.dosePattern`] = 'Use a pattern like 1+0+1';
    if (m.days < 1 || m.days > 365) fields[`medicines.${i}.durationDays`] = '1 to 365 days';
  });
  if (Object.keys(fields).length) throw bad('Check the prescription.', fields);
  return { diagnosis, medicines, tests, advice, followUpInDays: follow && follow > 0 ? Math.round(follow) : null };
};

export function registerHealthRoutes(kit: HealthKit) {
  const { requireUser, optionalUser, requirePartnerBusiness, requireAdmin } = kit;

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

  /** The doctor's own appointment by CODE (another doctor's: 404). */
  const doctorAppointment = (ctx: ShopCtx, doctor: MockDoctor) => {
    const code = decodeURIComponent(ctx.params[0]).toUpperCase();
    const a = ctx.db.health.appointments.find(x => x.code === code && x.doctorId === doctor.id);
    if (!a) throw notFound('Appointment');
    return a;
  };

  const listedDoctor = (h: MockHealth, id: string) => {
    const d = doctorById(h, decodeURIComponent(id));
    if (!d || !d.isListed) throw notListed();
    return d;
  };

  const pmdcOf = (db: MockDb, d: MockDoctor) => {
    const b = db.businesses.find(x => x.id === d.businessId);
    const p = db.health.pmdc[d.businessId ?? ''];
    return { verified: b ? !!b.pmdcVerified : p?.verified !== false, at: p?.at ?? null };
  };

  /** Cities with listed doctors (a clinic there), most doctors first. */
  const citiesOf = (h: MockHealth) => {
    const count = new Map<string, Set<string>>();
    for (const l of h.locations) {
      if (l.kind !== 'clinic' || !l.isActive || !doctorById(h, l.doctorId)?.isListed) continue;
      count.set(l.city, (count.get(l.city) ?? new Set()).add(l.doctorId));
    }
    return [...count.entries()].sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0])).map(([c]) => c);
  };

  /** The home's city: asked (in its usual spelling), the patient's default address city when doctors practise there, else the busiest. */
  const homeCity = (db: MockDb, user: MockUser | null, asked: string, cities: string[]) => {
    if (asked) return cities.find(c => c.toLowerCase() === asked.toLowerCase()) ?? asked;
    if (user) {
      const address = db.shop.addresses.filter(a => a.userId === user.id).sort((a, b) => Number(b.isDefault) - Number(a.isDefault))[0];
      const known = cities.find(c => c.toLowerCase() === (address?.city ?? user.city ?? '').toLowerCase());
      if (known) return known;
    }
    return cities[0] ?? 'Lahore';
  };

  // ══ Discovery (public) ═══════════════════════════════
  /** Live banners for this city, each with its resolved target; one whose target has gone is left out. */
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
          target = d ? { id: d.id, name: displayName(d) } : null;
        }
        const openable = b.targetType === 'screen' ? !!b.targetScreen : b.targetType === 'none' || !!target;
        return openable ? { b, target } : null;
      })
      .filter((x): x is { b: MockHealthBanner; target: { id: string; slug?: string; name: string } | null } => !!x)
      .sort((x, y) => x.b.sort - y.b.sort)
      .slice(0, 10)
      .map(({ b, target }) => ({ id: b.id, imageUrl: b.imageUrl, title: b.title, subtitle: b.subtitle, targetType: b.targetType, targetScreen: b.targetScreen, target }));

  /** `GET /health/doctors` (§4.1), shared by the home's rails. */
  const listDoctors = (h: MockHealth, query: Record<string, any>, now: number) => {
    const kind: ConsultKind | null = query.kind === 'video' || query.kind === 'clinic' ? query.kind : null;
    const city = text(query.city);
    const q = text(query.q);
    const minFee = num(query.minFee);
    const maxFee = num(query.maxFee);
    const minYears = num(query.minExperience);
    const minRating = num(query.minRating);
    const specialty = text(query.specialty) || h.specialties.find(s => s.id === query.specialtyId)?.slug || '';
    const condition = text(query.condition) || h.conditions.find(c => c.id === query.conditionId)?.slug || '';
    const today = todayInZone(PKT, now);
    const year = new Date(now).getUTCFullYear();
    const fee = (d: MockDoctor) => {
      const fees = locationsOf(h, d.id).filter(l => !kind || l.kind === kind).map(l => l.fee);
      return fees.length ? Math.min(...fees) : null;
    };
    let rows = h.doctors
      .filter(d => d.isListed)
      .filter(d => !specialty || d.specialtySlug === specialty || d.secondarySpecialtySlug === specialty)
      .filter(d => {
        if (!condition) return true;
        const c = h.conditions.find(x => x.slug === condition);
        return d.conditionSlugs.includes(condition) || (!!c?.specialtySlug && d.specialtySlug === c.specialtySlug);
      })
      .filter(d => {
        if (!q) return true;
        const conds = h.conditions.filter(c => matches(q, c.name, c.nameUr, ...c.aliases)).map(c => c.slug);
        const spec = specialtyBySlug(h, d.specialtySlug);
        return matches(q, d.name, spec?.name, spec?.nameUr) || d.conditionSlugs.some(s => conds.includes(s));
      })
      .filter(d => !city || kind === 'video' || locationsOf(h, d.id).some(l => l.kind === 'clinic' && l.city.toLowerCase() === city.toLowerCase()))
      .filter(d => !kind || locationsOf(h, d.id).some(l => l.kind === kind))
      .filter(d => !query.area || locationsOf(h, d.id).some(l => l.kind === 'clinic' && matches(String(query.area), l.area)))
      .filter(d => !query.gender || d.gender === query.gender)
      .filter(d => minFee === null || (fee(d) ?? -1) >= minFee)
      .filter(d => maxFee === null || (fee(d) ?? Infinity) <= maxFee)
      .filter(d => minYears === null || (d.practisingSince !== null && year - d.practisingSince >= minYears))
      .filter(d => !query.language || d.languages.some(l => l.toLowerCase() === String(query.language).toLowerCase()))
      .map(d => ({ d, card: cardWire(h, d, now, kind) }))
      .filter(x => minRating === null || x.card.ratingAvg >= minRating)
      .filter(x => !bool(query.availableToday) || (!!x.card.nextAvailable?.at && pkDay(x.card.nextAvailable.at) === today));
    const score = (x: (typeof rows)[number]) => (x.card.ratingAvg || 4) * Math.log10(10 + x.card.ratingCount) + (x.d.topBooked ? 1 : 0);
    const next = (x: (typeof rows)[number]) => (x.card.nextAvailable?.at ? Date.parse(x.card.nextAvailable.at) : Infinity);
    const sort = String(query.sort ?? 'recommended');
    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case 'earliest':
          return next(a) - next(b);
        case 'fee_asc':
          return (a.card.minFee ?? Infinity) - (b.card.minFee ?? Infinity);
        case 'fee_desc':
          return (b.card.minFee ?? -1) - (a.card.minFee ?? -1);
        case 'reviews':
          return b.card.ratingCount - a.card.ratingCount || b.card.ratingAvg - a.card.ratingAvg;
        case 'experience':
          return (b.card.yearsExperience ?? 0) - (a.card.yearsExperience ?? 0);
        default:
          return score(b) - score(a);
      }
    });
    return rows.map(x => x.card);
  };

  route('GET', '/health/home', ctx => {
    const { db, now, query } = ctx;
    const h = db.health;
    const user = optionalUser(ctx);
    if (user?.id === 'u_customer') ensureDemoVideo(h, now);
    const cities = citiesOf(h);
    const city = homeCity(db, user, text(query.city), cities);
    const featuredHere = listDoctors(h, { city, sort: 'recommended' }, now).slice(0, 10);
    const nationwide = !featuredHere.length;
    const upcoming =
      user && user.role === 'customer'
        ? h.appointments.filter(a => a.userId === user.id && isActive(a) && Date.parse(a.endAt) + 30 * MINUTE > now).sort(upcomingFirst)[0]
        : null;
    return {
      city,
      cities,
      specialties: h.specialties.filter(live).sort((a, b) => a.sort - b.sort).slice(0, 12).map(s => specialtyWire(h, s, city)),
      commonConditions: h.conditions.filter(c => live(c) && c.isCommon).map(c => conditionWire(h, c)),
      availableTodayNearby: listDoctors(h, { city, availableToday: 'true', sort: 'earliest' }, now).slice(0, 10),
      upcomingAppointment: upcoming ? patientAppointmentWire(h, upcoming, now) : null,
      featuredDoctors: nationwide ? listDoctors(h, { sort: 'recommended' }, now).slice(0, 10) : featuredHere,
      featuredScope: nationwide ? 'nationwide' : 'city',
      banners: liveBanners(h, city, now),
      emergencyNumbers: EMERGENCY_NUMBERS,
    };
  });

  route('GET', '/health/specialties', ({ db, query }) => {
    const h = db.health;
    const city = text(query.city) || null;
    return h.specialties.filter(live).sort((a, b) => a.sort - b.sort).map(s => specialtyWire(h, s, city));
  });

  route('GET', '/health/conditions', ({ db, query }) => {
    const h = db.health;
    const q = text(query.q);
    return h.conditions
      .filter(live)
      .filter(c => !q || matches(q, c.name, c.nameUr, ...c.aliases))
      .filter(c => !bool(query.common) || c.isCommon)
      .sort((a, b) => Number(b.isCommon) - Number(a.isCommon) || a.name.localeCompare(b.name))
      .map(c => conditionWire(h, c));
  });

  route('GET', '/health/search/suggest', ({ db, now, query }) => {
    const h = db.health;
    const q = text(query.q);
    if (q.length < 1) return { doctors: [], specialties: [], conditions: [] };
    const conditions = h.conditions.filter(c => live(c) && matches(q, c.name, c.nameUr, ...c.aliases));
    const specialties = h.specialties.filter(live).filter(
      s => matches(q, s.name, s.nameUr, s.slug.replace(/-/g, ' ')) || conditions.some(c => c.specialtySlug === s.slug),
    );
    const doctors = h.doctors
      .filter(d => d.isListed)
      .filter(
        d =>
          matches(q, d.name, displayName(d)) ||
          specialties.some(s => s.slug === d.specialtySlug) ||
          conditions.some(c => d.conditionSlugs.includes(c.slug)),
      )
      .sort((a, b) => Number(matches(q, b.name)) - Number(matches(q, a.name)) || Number(b.topBooked) - Number(a.topBooked))
      .slice(0, 5)
      .map(d => cardWire(h, d, now));
    return {
      doctors,
      specialties: specialties.slice(0, 3).map(s => ({ id: s.id, name: s.name, nameUr: s.nameUr, slug: s.slug, icon: iconKey(s.icon), description: null })),
      conditions: conditions.slice(0, 3).map(c => conditionWire(h, c)),
    };
  });

  route('GET', '/health/doctors', ({ db, now, query }) => paginate(listDoctors(db.health, query, now), query));

  route('GET', '/health/doctors/:id', ({ db, now, params }) => profileWire(db.health, listedDoctor(db.health, params[0]), now));

  route('GET', '/health/doctors/:id/similar', ({ db, now, params }) => {
    const h = db.health;
    const d = listedDoctor(h, params[0]);
    const cities = new Set(locationsOf(h, d.id).map(l => l.city));
    return h.doctors
      .filter(o => o.id !== d.id && o.isListed && o.specialtySlug === d.specialtySlug)
      .map(o => ({ o, same: locationsOf(h, o.id).some(l => cities.has(l.city)), card: cardWire(h, o, now) }))
      .sort((a, b) => Number(b.same) - Number(a.same) || b.card.ratingCount - a.card.ratingCount)
      .slice(0, 10)
      .map(x => x.card);
  });

  const locationOf = (h: MockHealth, doctorId: string, locId: string) => {
    const d = listedDoctor(h, doctorId);
    const loc = locationById(h, decodeURIComponent(locId));
    if (!loc || loc.doctorId !== d.id || !loc.isActive) throw notFound('Location');
    return loc;
  };

  route('GET', '/health/doctors/:id/locations/:loc/slots', ({ db, now, params, query }) => {
    const h = db.health;
    const loc = locationOf(h, params[0], params[1]);
    const days = num(query.days) ?? 7;
    if (days < 1 || days > 14) throw bad('days is 1 to 14.', { days: 'days must be between 1 and 14' });
    const today = todayInZone(loc.timezone, now);
    const from = DATE.test(String(query.from ?? '')) ? String(query.from) : today;
    return slotsWire(h, loc, from, Math.round(days), now);
  });

  route('GET', '/health/doctors/:id/reviews', ({ db, params, query }) => {
    const h = db.health;
    const d = listedDoctor(h, params[0]);
    const kind = query.kind === 'video' || query.kind === 'clinic' ? query.kind : null;
    const stars = num(query.rating);
    if (stars !== null && !(stars >= 1 && stars <= 5)) throw bad('rating is 1 to 5.', { rating: 'rating must not be greater than 5' });
    const rows = visibleReviews(h, d.id)
      .filter(r => !kind || r.kind === kind)
      .filter(r => stars === null || r.rating === stars)
      .sort((a, b) =>
        query.sort === 'highest'
          ? b.rating - a.rating || b.createdAt.localeCompare(a.createdAt)
          : query.sort === 'lowest'
            ? a.rating - b.rating || b.createdAt.localeCompare(a.createdAt)
            : b.createdAt.localeCompare(a.createdAt),
      )
      .map(r => reviewWire(h, r));
    return paginate(rows, query);
  });

  // ══ Appointments (patient) ═══════════════════════════
  /** Booking and reschedule replay the first answer to a repeated Idempotency-Key. */
  const idempotent = (ctx: ShopCtx, user: MockUser, run: () => { status: number; payload: unknown }) => {
    const h = ctx.db.health;
    const key = ctx.headers['idempotency-key'];
    if (!key) throw new HealthError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Missing Idempotency-Key.');
    const replay = h.idempotency[`${user.id}|${key}`];
    if (replay) {
      ctx.setStatus(replay.status);
      return replay.payload;
    }
    const out = run();
    h.idempotency[`${user.id}|${key}`] = out;
    ctx.setStatus(out.status);
    return out.payload;
  };

  /** SLOT_TAKEN, with the three nearest free times. */
  const slotTaken = (h: MockHealth, loc: MockLocation, startAt: string, now: number, message: string, ignoreId?: string) =>
    new HealthError(409, 'SLOT_TAKEN', message, {
      alternatives: alternativesAfter(h, loc, startAt, now, 3, ignoreId).map(s => ({
        startsAt: zoned(s.startAt, loc.timezone),
        endsAt: zoned(new Date(Date.parse(s.startAt) + loc.slotMinutes * MINUTE).toISOString(), loc.timezone),
      })),
    });

  /** Where a transfer goes and by when (a deadline only when the doctor asks for prepayment). */
  const transferTo = (h: MockHealth, doctor: MockDoctor, loc: MockLocation, startAt: string, now: number) => {
    const account = (h.paymentAccounts[doctor.id] ?? []).find(p => p.isActive);
    if (!account) return null;
    return {
      kind: account.kind,
      accountTitle: account.title,
      accountNumber: account.number,
      bankName: account.bankName,
      amount: loc.fee,
      payBy: loc.requiresPrepay
        ? new Date(Math.max(now + 10 * MINUTE, Math.min(now + PAY_WINDOW_MIN * MINUTE, Date.parse(startAt) - 15 * MINUTE))).toISOString()
        : startAt,
    };
  };

  route('POST', '/health/appointments', ctx => {
    const { db, now, body } = ctx;
    const h = db.health;
    const user = requireCustomer(ctx);
    return idempotent(ctx, user, () => {
      const doctor = listedDoctor(h, String(body.doctorId ?? ''));
      const loc = locationById(h, String(body.locationId ?? ''));
      if (!loc || loc.doctorId !== doctor.id || !loc.isActive) throw notFound('Location');
      const startAt = instantOf(body.startsAt);
      if (!startAt) throw bad('Choose a time.', { startsAt: 'startsAt must be a valid ISO 8601 date string' });
      const member = body.familyMemberId ? h.family.find(f => f.id === body.familyMemberId && f.userId === user.id) : null;
      if (body.familyMemberId && !member) throw notFound('Family member');
      const recordIds: string[] = Array.isArray(body.attachmentRecordIds) ? body.attachmentRecordIds : [];
      if (recordIds.some(id => !h.records.some(r => r.id === id && r.userId === user.id))) throw notFound('Record');
      // Clinic visits are paid at the clinic; video is always a transfer.
      const method: AppointmentPaymentMethod = loc.kind === 'video' ? 'transfer' : 'pay_at_visit';
      const asked = body.paymentMethod;
      if (asked && asked !== (method === 'transfer' ? 'transfer' : 'pay_at_clinic')) {
        throw bad(loc.kind === 'video' ? 'Video consultations are paid by transfer.' : 'Clinic visits are paid at the clinic.', { paymentMethod: 'Not available for this visit' });
      }
      const date = dateInZone(startAt, loc.timezone);
      const all = slotsFor(h, loc, date, now);
      if (!all.length && !h.appointments.some(a => a.locationId === loc.id && a.startAt === startAt && isActive(a))) {
        throw new HealthError(400, 'SLOT_INVALID', 'That time is not one of the doctor’s slots.');
      }
      const free = all.some(s => s.startAt === startAt);
      // Mock mode's race: at Dr. Bilal's Gulberg clinic the first free time of
      // a day is always taken by another patient a moment before you confirm.
      // Once per day at that clinic, so picking an alternative then books it.
      const contestedKey = `${loc.id}|${date}`;
      const contested = free && loc.id === 'loc_bilal_2' && !h.contested.includes(contestedKey) && all[0]?.startAt === startAt;
      if (contested) {
        h.contested.push(contestedKey);
        h.appointments.push(
          newAppointment(h, {
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
          }),
        );
        // Kept even though this request fails: the slot really is gone.
        throw Object.assign(slotTaken(h, loc, startAt, now, 'Someone booked this time a moment ago. Choose another time.'), { keepChanges: true });
      }
      if (!free) throw slotTaken(h, loc, startAt, now, 'This time is no longer available. Choose another time.');
      const mine = h.appointments.filter(a => a.userId === user.id && (a.familyMemberId ?? null) === (member?.id ?? null) && isActive(a));
      const end = Date.parse(startAt) + loc.slotMinutes * MINUTE;
      const overlap = mine.find(a => Date.parse(a.startAt) < end && Date.parse(startAt) < Date.parse(a.endAt));
      if (overlap) throw new HealthError(409, 'PATIENT_OVERLAP', 'You already have an appointment at that time.', { appointmentCode: overlap.code });
      if (h.appointments.filter(a => a.userId === user.id && a.doctorId === doctor.id && isActive(a) && Date.parse(a.startAt) > now).length >= 3) {
        throw new HealthError(409, 'BOOKING_LIMIT', 'You already have 3 upcoming appointments with this doctor.');
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
        reasonTags: (Array.isArray(body.symptoms) ? body.symptoms : []).filter((t: ReasonTag) => REASON_TAGS.includes(t)),
        reason: text(body.reason).slice(0, 500) || null,
        recordIds,
        paymentMethod: method,
        now,
      });
      if (method === 'transfer') a.instructions = transferTo(h, doctor, loc, startAt, now);
      h.appointments.push(a);
      if (doctor.ownerId) {
        notifyHealth(db, doctor.ownerId, 'health.appointment.new', 'New appointment', `${a.patientName} booked ${loc.kind === 'video' ? 'a video consultation' : `a visit at ${loc.name}`}.`, {
          appointmentCode: a.code,
        });
      }
      return { status: 201, payload: patientAppointmentWire(h, a, now, true) };
    });
  });

  route('GET', '/health/appointments', ctx => {
    const { db, now, query } = ctx;
    const h = db.health;
    const user = requireCustomer(ctx);
    if (user.id === 'u_customer') ensureDemoVideo(h, now);
    const mine = h.appointments.filter(a => a.userId === user.id);
    const upcoming = (a: MockAppointment) => isActive(a) && Date.parse(a.endAt) + 30 * MINUTE > now;
    const rows = query.scope === 'past' ? mine.filter(a => !upcoming(a)).sort(latestFirst) : mine.filter(upcoming).sort(upcomingFirst);
    return paginate(rows.map(a => patientAppointmentWire(h, a, now)), query);
  });

  route('GET', '/health/appointments/:code', ctx => patientAppointmentWire(ctx.db.health, myAppointment(ctx, requireCustomer(ctx)), ctx.now, true));

  /** A cancel voids what was owed and makes a refund due on what was paid. */
  const settlePaymentOnCancel = (a: MockAppointment, now: number) => {
    if (a.paymentStatus === 'paid' || a.paymentStatus === 'proof_submitted') {
      a.paymentStatus = 'refund_due';
      addEvent(a, 'refund_due', null, now);
    } else if (a.paymentStatus !== 'collected' && a.paymentStatus !== 'refunded') a.paymentStatus = 'void';
  };

  route('POST', '/health/appointments/:code/cancel', ctx => {
    const { db, now, body } = ctx;
    const h = db.health;
    const a = myAppointment(ctx, requireCustomer(ctx));
    if (!(a.status === 'awaiting_payment' || a.status === 'confirmed')) throw transition('This appointment can no longer be cancelled.');
    if (Date.parse(a.startAt) <= now) throw new HealthError(409, 'CANCEL_CUTOFF_PASSED', 'The appointment has started; it can no longer be cancelled.');
    const reason = text(body.reason);
    if (reason.length < 2) throw bad('Say why you are cancelling.', { reason: 'reason must be longer than or equal to 2 characters' });
    a.lateCancel = isLateCancel(h, a, now);
    a.status = 'cancelled';
    a.cancelledBy = 'patient';
    a.cancelReason = reason.slice(0, 500);
    settlePaymentOnCancel(a, now);
    addEvent(a, 'cancelled', a.lateCancel ? 'Late cancellation' : null, now);
    const d = doctorById(h, a.doctorId);
    if (d?.ownerId) notifyHealth(db, d.ownerId, 'health.appointment.cancelled', 'Appointment cancelled', `${a.patientName} cancelled ${a.code}.`, { appointmentCode: a.code });
    return patientAppointmentWire(h, a, now, true);
  });

  /** The new time is a new appointment (a new code); the old one is cancelled, its payment carried over. */
  route('POST', '/health/appointments/:code/reschedule', ctx => {
    const { db, now, body } = ctx;
    const h = db.health;
    const user = requireCustomer(ctx);
    const old = myAppointment(ctx, user);
    return idempotent(ctx, user, () => {
      if (old.rescheduledFromId || old.rescheduleCount > 0) throw new HealthError(409, 'RESCHEDULE_NOT_ALLOWED', 'An appointment can be moved once. Cancel and book again instead.');
      if (!(old.status === 'awaiting_payment' || old.status === 'confirmed')) throw transition('This appointment can no longer be rescheduled.');
      const hours = cancelCutoff(h, old);
      if (now >= Date.parse(old.startAt) - hours * HOUR) {
        throw new HealthError(409, 'CANCEL_CUTOFF_PASSED', `Rescheduling closes ${hours * 60} minutes before the appointment.`, { cutoffMinutes: hours * 60 });
      }
      const loc = locationById(h, old.locationId)!;
      const startAt = instantOf(body.startsAt);
      if (!startAt) throw bad('Choose a new time.', { startsAt: 'startsAt must be a valid ISO 8601 date string' });
      if (!slotsFor(h, loc, dateInZone(startAt, loc.timezone), now, old.id).some(s => s.startAt === startAt)) {
        throw slotTaken(h, loc, startAt, now, 'This time is no longer available. Choose another time.', old.id);
      }
      const a = newAppointment(h, { ...old, loc, startAt, now });
      a.rescheduledFromId = old.id;
      a.rescheduleCount = 1;
      a.events = [{ type: 'rescheduled', note: null, createdAt: isoNow(now) }];
      // A paid or claimed payment moves to the new appointment.
      if (old.paymentStatus === 'paid' || old.paymentStatus === 'proof_submitted') {
        a.paymentStatus = old.paymentStatus;
        a.proof = old.proof;
        a.status = 'confirmed';
      }
      a.instructions = old.instructions ? { ...old.instructions, payBy: a.status === 'awaiting_payment' ? old.instructions.payBy : startAt } : null;
      old.status = 'cancelled';
      old.cancelledBy = 'patient';
      old.cancelReason = 'rescheduled';
      old.paymentStatus = 'void';
      addEvent(old, 'cancelled', 'Rescheduled', now);
      h.appointments.push(a);
      const d = doctorById(h, a.doctorId);
      if (d?.ownerId) notifyHealth(db, d.ownerId, 'health.appointment.new', 'Appointment moved', `${a.patientName} moved ${old.code} to ${a.code}.`, { appointmentCode: a.code });
      return { status: 200, payload: patientAppointmentWire(h, a, now, true) };
    });
  });

  route('POST', '/health/appointments/:code/payment-proof', ctx => {
    const { db, now, body } = ctx;
    const h = db.health;
    const a = myAppointment(ctx, requireCustomer(ctx));
    if (a.paymentMethod !== 'transfer' || !(a.paymentStatus === 'awaiting_transfer' || a.paymentStatus === 'proof_rejected') || !(a.status === 'awaiting_payment' || a.status === 'confirmed')) {
      throw transition('No payment is due for this appointment.');
    }
    const ref = text(body.paymentRef);
    if (ref.length < 3) throw bad('Enter the transaction reference.', { paymentRef: 'paymentRef must be longer than or equal to 3 characters' });
    a.proof = { transactionId: ref, imageUrl: typeof body.proofUrl === 'string' ? body.proofUrl : null, submittedAt: isoNow(now), rejectionReason: null };
    a.paymentStatus = 'proof_submitted';
    addEvent(a, 'payment_proof_submitted', ref, now);
    const d = doctorById(h, a.doctorId);
    if (d?.ownerId) notifyHealth(db, d.ownerId, 'health.payment.proof', 'Payment to check', `${a.patientName} sent ${ref} for ${a.code}.`, { appointmentCode: a.code });
    return patientAppointmentWire(h, a, now, true);
  });

  const attachmentsWire = (h: MockHealth, a: MockAppointment) =>
    a.recordIds
      .map(id => h.records.find(r => r.id === id))
      .filter(Boolean)
      .map(r => ({ id: r!.id, title: r!.title, type: r!.type }));

  route('GET', '/health/appointments/:code/attachments', ctx => attachmentsWire(ctx.db.health, myAppointment(ctx, requireCustomer(ctx))));
  route('POST', '/health/appointments/:code/attachments', ctx => {
    const h = ctx.db.health;
    const user = requireCustomer(ctx);
    const a = myAppointment(ctx, user);
    if (!isActive(a)) throw new HealthError(409, 'ATTACHMENTS_CLOSED', 'Records can be shared only before the visit ends.');
    const ids: string[] = Array.isArray(ctx.body.recordIds) ? ctx.body.recordIds : [];
    if (!ids.length || ids.length > 10) throw bad('Share 1 to 10 records.', { recordIds: 'recordIds must contain 1 to 10 ids' });
    for (const id of ids) {
      const r = h.records.find(x => x.id === id && x.userId === user.id);
      if (!r) throw notFound('Record');
      if ((r.memberId ?? null) !== (a.familyMemberId ?? null)) throw bad('That record is about someone else.', { recordIds: 'Not about this visit’s patient' });
    }
    a.recordIds = [...new Set([...a.recordIds, ...ids])].slice(0, 10);
    ctx.setStatus(201);
    return attachmentsWire(h, a);
  });
  route('DELETE', '/health/appointments/:code/attachments/:recordId', ctx => {
    const user = requireCustomer(ctx);
    const a = myAppointment(ctx, user);
    a.recordIds = a.recordIds.filter(id => id !== decodeURIComponent(ctx.params[1]));
    return { removed: true };
  });

  route('POST', '/health/appointments/:code/review', ctx => {
    const { db, now, body } = ctx;
    const h = db.health;
    const user = requireCustomer(ctx);
    const a = myAppointment(ctx, user);
    if (a.reviewId) throw new HealthError(409, 'REVIEW_EXISTS', 'You have already rated this visit.');
    if (a.status !== 'completed') throw new HealthError(403, 'REVIEW_NOT_ALLOWED', 'Only completed visits can be rated.', { reason: 'not_completed' });
    if (now - Date.parse(a.completedAt ?? a.endAt) > REVIEW_WINDOW_DAYS * DAY) {
      throw new HealthError(403, 'REVIEW_NOT_ALLOWED', 'Visits can be rated for 30 days.', { reason: 'window_closed' });
    }
    const score = (v: unknown) => {
      const n = Math.round(Number(v));
      return n >= 1 && n <= 5 ? n : null;
    };
    const overall = score(body.overall);
    const diagnosis = score(body.diagnosis);
    if (!overall || !diagnosis) throw bad('Rate the visit.', { ...(overall ? {} : { overall: 'overall must be 1 to 5' }), ...(diagnosis ? {} : { diagnosis: 'diagnosis must be 1 to 5' }) });
    const dims: Record<string, number> = { diagnosis };
    const staff = score(body.staff);
    const environment = score(body.environment);
    if (staff) dims.staff = staff;
    if (environment && a.kind === 'clinic') dims.environment = environment;
    const codes = Object.values(REVIEW_TAG_CODES) as string[];
    const review = {
      id: nextId(h, 'rv'),
      doctorId: a.doctorId,
      appointmentId: a.id,
      userId: user.id,
      authorName: user.name,
      anonymous: body.isAnonymous === true,
      rating: overall,
      recommend: body.recommend !== false,
      dimensions: dims,
      tags: (Array.isArray(body.tags) ? body.tags : []).filter((t: string) => codes.includes(t)).map(reviewTagLabel),
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
    return reviewWire(h, review);
  });

  /** docs/VIDEO.md: inside the window, a video visit, booked or under way; a prepaid one must be paid. */
  const joinCheck = (a: MockAppointment, now: number) => {
    if (a.kind !== 'video') throw new HealthError(409, 'VIDEO_NOT_JOINABLE', 'This is a clinic visit.', { reason: 'not_video' });
    if (!(a.status === 'confirmed' || a.status === 'checked_in' || a.status === 'in_progress' || a.status === 'awaiting_payment')) {
      throw new HealthError(409, 'VIDEO_NOT_JOINABLE', 'This consultation is not open.', { reason: 'status' });
    }
    if (!canJoin({ ...a, status: a.status === 'awaiting_payment' ? 'confirmed' : a.status }, now)) {
      const w = videoWindow(a);
      throw new HealthError(409, 'VIDEO_NOT_JOINABLE', 'The consultation room opens 10 minutes before the time.', { reason: 'window', ...w });
    }
    if (a.status === 'awaiting_payment') throw new HealthError(402, 'PAYMENT_REQUIRED', 'The doctor asks for payment before the consultation.');
  };

  route('POST', '/health/appointments/:code/video/join', ctx => {
    const a = myAppointment(ctx, requireCustomer(ctx));
    joinCheck(a, ctx.now);
    return videoJoinWire(a, roomUrl(a, a.patientName), a.patientName, false);
  });

  // ══ Family, records, prescriptions ═══════════════════
  const familyInput = (body: Record<string, any>) => {
    const fields: Record<string, string> = {};
    const name = text(body.fullName);
    if (name.length < 2) fields.fullName = 'Enter their full name';
    if (!['spouse', 'child', 'parent', 'sibling', 'other'].includes(body.relation)) fields.relation = 'Choose the relation';
    if (body.gender && !['male', 'female', 'other'].includes(body.gender)) fields.gender = 'Choose the gender';
    if (body.dateOfBirth && !DATE.test(String(body.dateOfBirth))) fields.dateOfBirth = 'Use YYYY-MM-DD';
    if (Object.keys(fields).length) throw bad('Check the details.', fields);
    return { name, relation: body.relation, gender: body.gender ?? 'other', dateOfBirth: body.dateOfBirth ? String(body.dateOfBirth) : '', phone: text(body.phone) || null };
  };

  route('GET', '/health/family-members', ctx => {
    const user = requireCustomer(ctx);
    return ctx.db.health.family.filter(f => f.userId === user.id).map(m => familyWire(m, ctx.now));
  });
  route('POST', '/health/family-members', ctx => {
    const h = ctx.db.health;
    const user = requireCustomer(ctx);
    if (h.family.filter(f => f.userId === user.id).length >= 8) throw new HealthError(409, 'FAMILY_LIMIT', 'You can add up to 8 family members.');
    const m = { id: nextId(h, 'fm'), userId: user.id, ...familyInput(ctx.body) };
    h.family.push(m);
    ctx.setStatus(201);
    return familyWire(m, ctx.now);
  });
  const myMember = (ctx: ShopCtx) => {
    const user = requireCustomer(ctx);
    const m = ctx.db.health.family.find(f => f.id === decodeURIComponent(ctx.params[0]) && f.userId === user.id);
    if (!m) throw notFound('Family member');
    return m;
  };
  route('GET', '/health/family-members/:id', ctx => familyWire(myMember(ctx), ctx.now));
  route('PATCH', '/health/family-members/:id', ctx => {
    const m = myMember(ctx);
    Object.assign(m, familyInput({ fullName: m.name, relation: m.relation, gender: m.gender, dateOfBirth: m.dateOfBirth || undefined, phone: m.phone, ...ctx.body }));
    return familyWire(m, ctx.now);
  });
  route('DELETE', '/health/family-members/:id', ctx => {
    const h = ctx.db.health;
    const m = myMember(ctx);
    // Past appointments keep their snapshot; the member's records go with them.
    h.family = h.family.filter(f => f.id !== m.id);
    h.records = h.records.filter(r => r.memberId !== m.id);
    return { removed: true };
  });

  route('GET', '/health/records', ctx => {
    const h = ctx.db.health;
    const user = requireCustomer(ctx);
    const person = text(ctx.query.person);
    const rows = h.records
      .filter(r => r.userId === user.id)
      .filter(r => !person || (person === 'self' ? r.memberId === null : r.memberId === person))
      .filter(r => !ctx.query.type || recordWire(h, r, ctx.now).type === ctx.query.type)
      .sort((a, b) => b.recordedOn.localeCompare(a.recordedOn) || b.createdAt.localeCompare(a.createdAt))
      .map(r => recordWire(h, r, ctx.now));
    return paginate(rows, ctx.query);
  });
  route('POST', '/health/records', ctx => {
    const { db, now, body } = ctx;
    const h = db.health;
    const user = requireCustomer(ctx);
    const fields: Record<string, string> = {};
    const title = text(body.title);
    if (title.length < 2) fields.title = 'Give the record a title';
    if (!RECORD_TYPES.includes(body.type)) fields.type = 'Choose a type';
    if (body.recordDate && !DATE.test(String(body.recordDate))) fields.recordDate = 'Use YYYY-MM-DD';
    const files = (Array.isArray(body.files) ? body.files : []).filter((f: any) => typeof f?.url === 'string' && typeof f?.publicId === 'string');
    if (!files.length || files.length > 10) fields.files = 'Add 1 to 10 files';
    if (body.familyMemberId && !h.family.some(f => f.id === body.familyMemberId && f.userId === user.id)) fields.familyMemberId = 'Not one of your family members';
    if (Object.keys(fields).length) throw bad('Check the record.', fields);
    const r = {
      id: nextId(h, 'rec'),
      userId: user.id,
      memberId: body.familyMemberId || null,
      title,
      type: recordTypeIn(body.type) as RecordType,
      recordedOn: body.recordDate ? String(body.recordDate) : todayInZone(PKT, now),
      files: files.map((f: any) => ({ url: f.url, mime: typeof f.mime === 'string' ? f.mime : 'image/jpeg' })),
      createdAt: isoNow(now),
    };
    h.records.push(r);
    ctx.setStatus(201);
    return recordWire(h, r, now);
  });
  const myRecord = (ctx: ShopCtx) => {
    const user = requireCustomer(ctx);
    const r = ctx.db.health.records.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.userId === user.id);
    if (!r) throw notFound('Record');
    return r;
  };
  route('GET', '/health/records/:id', ctx => recordWire(ctx.db.health, myRecord(ctx), ctx.now));
  route('PATCH', '/health/records/:id', ctx => {
    const r = myRecord(ctx);
    const b = ctx.body;
    if (b.title !== undefined) r.title = text(b.title) || r.title;
    if (b.type !== undefined && RECORD_TYPES.includes(b.type)) r.type = recordTypeIn(b.type) as RecordType;
    if (b.recordDate !== undefined && DATE.test(String(b.recordDate))) r.recordedOn = String(b.recordDate);
    return recordWire(ctx.db.health, r, ctx.now);
  });
  route('DELETE', '/health/records/:id', ctx => {
    const h = ctx.db.health;
    const r = myRecord(ctx);
    h.records = h.records.filter(x => x.id !== r.id);
    for (const a of h.appointments) a.recordIds = a.recordIds.filter(id => id !== r.id);
    return { removed: true };
  });

  route('GET', '/health/prescriptions', ctx => {
    const h = ctx.db.health;
    const user = requireCustomer(ctx);
    const member = text(ctx.query.familyMemberId);
    const rows = h.prescriptions
      .map(p => ({ p, a: h.appointments.find(a => a.id === p.appointmentId) }))
      .filter(x => x.a?.userId === user.id && (!member || x.a.familyMemberId === member))
      .sort((x, y) => y.p.issuedAt.localeCompare(x.p.issuedAt))
      .map(({ p }) => prescriptionWire(h, p, ctx.now));
    return paginate(rows, ctx.query);
  });
  route('GET', '/health/prescriptions/:id', ctx => {
    const h = ctx.db.health;
    const user = requireCustomer(ctx);
    const p = h.prescriptions.find(x => x.id === decodeURIComponent(ctx.params[0]));
    const a = p ? h.appointments.find(x => x.id === p.appointmentId) : null;
    if (!p || a?.userId !== user.id) throw notFound('Prescription');
    return prescriptionWire(h, p, ctx.now);
  });

  route('POST', '/health/symptom-checker', ctx => {
    const h = ctx.db.health;
    requireCustomer(ctx);
    const t = text(ctx.body.text);
    if (t.length < 10 || t.length > 1000) throw bad('Describe how you feel.', { text: 'text must be 10 to 1000 characters' });
    const checkId = `sc_${Math.random().toString(36).slice(2, 10)}`;
    const result = checkSymptoms(t);
    if (result.emergency) {
      return {
        checkId,
        emergency: true,
        source: 'red_flag',
        flags: [{ id: 'red_flag', label: 'A sign that needs urgent care' }],
        message: EMERGENCY_MESSAGE,
        numbers: EMERGENCY_NUMBERS,
        disclaimer: DISCLAIMER,
      };
    }
    const s = specialtyBySlug(h, result.slug) ?? specialtyBySlug(h, 'general-physician');
    return {
      checkId,
      emergency: false,
      source: 'fallback',
      urgency: 'routine',
      advice: 'Book a visit in the coming days. If you feel worse, see a doctor sooner.',
      areasToDiscuss: result.areas.map(a => ({ title: a.title, explanation: a.body })),
      specialty: s ? { id: s.id, name: s.name, nameUr: s.nameUr, slug: s.slug, icon: iconKey(s.icon), description: null } : null,
      alternatives: [],
      disclaimer: DISCLAIMER,
    };
  });

  // ══ Doctor: profile and practice ═════════════════════
  route('GET', '/health/doctor/profile', ctx => {
    const { doctor } = myDoctor(ctx);
    return ownProfileWire(ctx.db.health, doctor, ctx.now, pmdcOf(ctx.db, doctor));
  });

  route('PATCH', '/health/doctor/profile', ctx => {
    const { doctor: d } = myDoctor(ctx);
    const b = ctx.body;
    const h = ctx.db.health;
    const fields: Record<string, string> = {};
    if (b.fullName !== undefined && text(b.fullName).length < 3) fields.fullName = 'Enter your full name';
    const primary = b.primarySpecialtyId !== undefined ? h.specialties.find(s => s.id === b.primarySpecialtyId) : undefined;
    if (b.primarySpecialtyId !== undefined && !primary) fields.primarySpecialtyId = 'Choose your specialty';
    if (b.about !== undefined && String(b.about).length > 2000) fields.about = 'Keep it under 2,000 characters';
    if (b.videoPrepayRequired === true && !(h.paymentAccounts[d.id] ?? []).some(a => a.isActive)) {
      fields.videoPrepayRequired = 'Add a payment account first';
    }
    if (Array.isArray(b.experiences) && b.experiences.some((e: any) => !Number.isFinite(Number(e?.fromYear)))) fields['experiences.fromYear'] = 'fromYear is required';
    if (Object.keys(fields).length) throw bad('Check your profile.', fields);
    // A new photo must be the doctor's own upload; re-sending the current one is fine (A9).
    if (b.title !== undefined) d.title = TITLE_LABEL[b.title] ?? d.title;
    if (b.fullName !== undefined) d.name = text(b.fullName);
    for (const k of ['gender', 'photoUrl', 'languages', 'about', 'services'] as const) if (b[k] !== undefined) (d as any)[k] = typeof b[k] === 'string' ? b[k].trim() : b[k];
    if (primary) d.specialtySlug = primary.slug;
    if (Array.isArray(b.secondarySpecialtyIds)) d.secondarySpecialtySlug = h.specialties.find(s => s.id === b.secondarySpecialtyIds[0])?.slug ?? null;
    if (b.practicingSince !== undefined) d.practisingSince = num(b.practicingSince);
    if (Array.isArray(b.qualifications)) d.qualifications = b.qualifications.map((q: any) => ({ degree: text(q.degree), institute: text(q.institute), year: num(q.year) }));
    if (Array.isArray(b.experiences)) d.experience = b.experiences.map((e: any) => ({ role: text(e.designation), place: text(e.institute), from: num(e.fromYear), to: num(e.toYear) }));
    if (Array.isArray(b.conditionIds)) d.conditionSlugs = b.conditionIds.map((id: string) => h.conditions.find(c => c.id === id)?.slug).filter((x: string | undefined): x is string => !!x);
    if (b.bookingWindowDays !== undefined) d.bookingRules.windowDays = Math.min(30, Math.max(1, Math.round(Number(b.bookingWindowDays))));
    if (b.minNoticeMinutes !== undefined) d.bookingRules.minNoticeMinutes = Math.max(0, Math.round(Number(b.minNoticeMinutes)));
    if (b.cancelCutoffMinutes !== undefined) d.bookingRules.cancelCutoffHours = Math.max(0, Number(b.cancelCutoffMinutes)) / 60;
    if (b.videoPrepayRequired !== undefined) {
      d.bookingRules.videoPrepay = !!b.videoPrepayRequired;
      for (const l of locationsOf(h, d.id)) if (l.kind === 'video') l.requiresPrepay = !!b.videoPrepayRequired;
    }
    return ownProfileWire(h, d, ctx.now, pmdcOf(ctx.db, d));
  });

  route('GET', '/health/doctor/profile/completeness', ctx => {
    const { doctor } = myDoctor(ctx);
    return completenessWire(ctx.db.health, doctor, pmdcOf(ctx.db, doctor).verified);
  });

  route('POST', '/health/doctor/listing/publish', ctx => {
    const { business, doctor } = myDoctor(ctx);
    const c = completenessWire(ctx.db.health, doctor, pmdcOf(ctx.db, doctor).verified);
    if (c.percent < 100) throw new HealthError(422, 'PROFILE_INCOMPLETE', 'Finish the checklist before patients can find you.', { missing: c.missing });
    doctor.isListed = true;
    business.isListed = true;
    return { isListed: true };
  });
  route('POST', '/health/doctor/listing/unpublish', ctx => {
    const { business, doctor } = myDoctor(ctx);
    doctor.isListed = false;
    business.isListed = false;
    return { isListed: false };
  });

  const locationInput = (body: Record<string, any>, d: MockDoctor, partial = false) => {
    const fields: Record<string, string> = {};
    const kind: ConsultKind = body.kind === 'video' ? 'video' : 'clinic';
    const out: Partial<MockLocation> = {};
    if (!partial || body.kind !== undefined) out.kind = kind;
    if (!partial || body.name !== undefined) {
      out.name = text(body.name) || (kind === 'video' ? 'Video consultation' : '');
      if (out.name.length < 2) fields.name = 'Enter a name';
    }
    if (!partial || body.area !== undefined) out.area = text(body.area);
    if (!partial || body.city !== undefined) out.city = text(body.city) || d.city;
    if (!partial || body.fee !== undefined) {
      out.fee = Math.round(Number(body.fee));
      if (!(out.fee >= 0 && out.fee <= 100000)) fields.fee = 'Enter the fee in rupees';
    }
    if (!partial || body.slotMinutes !== undefined) {
      out.slotMinutes = Math.round(Number(body.slotMinutes ?? 15));
      if (!(out.slotMinutes >= 10 && out.slotMinutes <= 60)) fields.slotMinutes = 'slotMinutes is 10 to 60';
    }
    if (!partial || body.addressLine !== undefined) out.address = text(body.addressLine) || null;
    for (const k of ['phone', 'instructions'] as const) if (!partial || body[k] !== undefined) (out as any)[k] = text(body[k]) || null;
    for (const k of ['lat', 'lng'] as const) if (!partial || body[k] !== undefined) (out as any)[k] = num(body[k]);
    if (kind === 'clinic' && (!partial || body.area !== undefined) && (out.area ?? '').length < 2) fields.area = 'Enter the area';
    if (Object.keys(fields).length) throw bad('Check the location.', fields);
    return out;
  };

  route('GET', '/health/doctor/locations', ctx => {
    const { doctor } = myDoctor(ctx);
    return ctx.db.health.locations.filter(l => l.doctorId === doctor.id).map(l => doctorLocationWire(ctx.db.health, l, ctx.now));
  });
  route('POST', '/health/doctor/locations', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const input = locationInput(ctx.body, doctor);
    if (input.kind === 'video' && locationsOf(h, doctor.id).some(l => l.kind === 'video')) {
      throw new HealthError(409, 'CONFLICT', 'You already offer video consultations. Edit that location instead.');
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
      requiresPrepay: doctor.bookingRules.videoPrepay,
      hours: [1, 2, 3, 4, 5, 6, 7].map(day => ({ day, ranges: [] })),
      isActive: true,
      ...input,
    };
    h.locations.push(loc);
    ctx.setStatus(201);
    return doctorLocationWire(h, loc, ctx.now);
  });
  const ownLocation = (ctx: ShopCtx, d: MockDoctor) => {
    const l = locationById(ctx.db.health, decodeURIComponent(ctx.params[0]));
    if (!l || l.doctorId !== d.id || !l.isActive) throw notFound('Location');
    return l;
  };
  route('PATCH', '/health/doctor/locations/:id', ctx => {
    const { doctor } = myDoctor(ctx);
    const l = ownLocation(ctx, doctor);
    Object.assign(l, locationInput({ kind: l.kind, ...ctx.body }, doctor, true));
    return doctorLocationWire(ctx.db.health, l, ctx.now);
  });
  route('DELETE', '/health/doctor/locations/:id', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const l = ownLocation(ctx, doctor);
    const booked = h.appointments.filter(a => a.locationId === l.id && isActive(a) && Date.parse(a.startAt) > ctx.now);
    if (booked.length) {
      throw new HealthError(409, 'LOCATION_HAS_BOOKINGS', `${booked.length} upcoming ${booked.length === 1 ? 'appointment is' : 'appointments are'} booked here. Move or cancel them first.`, {
        appointments: booked.map(a => a.code),
      });
    }
    l.isActive = false;
    return { removed: true };
  });
  route('GET', '/health/doctor/locations/:id/schedule', ctx => scheduleWire(ownLocation(ctx, myDoctor(ctx).doctor)));
  route('PUT', '/health/doctor/locations/:id/schedule', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const l = ownLocation(ctx, doctor);
    const hours = weekFromBody(ctx.body);
    for (const d of hours) {
      for (const other of locationsOf(h, doctor.id)) {
        if (other.id === l.id) continue;
        const theirs = other.hours.find(x => x.day === d.day)?.ranges ?? [];
        for (const r of d.ranges) {
          const clash = theirs.find(t => toMin(r.from) < toMin(t.to) && toMin(t.from) < toMin(r.to));
          if (clash) {
            const weekday = d.day === 7 ? 0 : d.day;
            throw new HealthError(409, 'SCHEDULE_OVERLAP', `These hours overlap your hours at ${other.name}.`, {
              range: { locationId: l.id, weekday, start: r.from, end: r.to },
              conflict: { locationId: other.id, locationName: other.name, weekday, start: clash.from, end: clash.to },
            });
          }
        }
      }
    }
    l.hours = hours;
    return scheduleWire(l);
  });

  route('GET', '/health/doctor/availability/preview', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const n = Math.min(14, Math.max(1, Math.round(num(ctx.query.days) ?? 7)));
    doctor.previewSeen = true;
    return {
      locations: locationsOf(h, doctor.id).map(l => {
        const from = DATE.test(String(ctx.query.from ?? '')) ? String(ctx.query.from) : todayInZone(l.timezone, ctx.now);
        // Patients can't see an unlisted doctor yet; the preview shows the same slots as if listed.
        const listed = doctor.isListed;
        doctor.isListed = true;
        const view = slotsWire(h, l, from, n, ctx.now);
        doctor.isListed = listed;
        return { location: view.location, days: view.days };
      }),
    };
  });

  /** Time off is stored as whole days in Pakistan time; the API speaks instants. */
  const timeOffWire = (t: MockHealth['timeOff'][number]) => ({
    id: t.id,
    locationId: t.locationId,
    startsAt: `${t.from}T00:00:00+05:00`.replace(/^(.*)$/, s => new Date(s).toISOString()),
    endsAt: new Date(`${addDays(t.to, 1)}T00:00:00+05:00`).toISOString(),
    reason: t.reason,
  });

  route('GET', '/health/doctor/time-off', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const from = addDays(todayInZone(PKT, ctx.now), -30);
    return h.timeOff
      .filter(t => t.doctorId === doctor.id && t.to >= from)
      .sort((a, b) => a.from.localeCompare(b.from))
      .map(timeOffWire);
  });
  route('POST', '/health/doctor/time-off', ctx => {
    const { db, now, body } = ctx;
    const { doctor } = myDoctor(ctx);
    const h = db.health;
    const start = instantOf(body.startsAt);
    const end = instantOf(body.endsAt);
    if (!start || !end) throw bad('Choose the dates.', { startsAt: 'startsAt must be a valid ISO 8601 date string' });
    if (Date.parse(end) <= Date.parse(start)) throw bad('The end is before the start.', { endsAt: 'endsAt must be after startsAt' });
    const locationId = body.locationId ? String(body.locationId) : null;
    if (locationId && !locationsOf(h, doctor.id).some(l => l.id === locationId)) throw notFound('Location');
    const affected = h.appointments
      .filter(
        a =>
          a.doctorId === doctor.id &&
          isActive(a) &&
          (!locationId || a.locationId === locationId) &&
          Date.parse(a.startAt) < Date.parse(end) &&
          Date.parse(start) < Date.parse(a.endAt),
      )
      .sort(upcomingFirst);
    if (affected.length && !bool(body.cancelAffected)) {
      throw new HealthError(409, 'TIME_OFF_CONFLICTS', `${affected.length} patient(s) are booked in that time. Send cancelAffected: true to cancel them.`, {
        appointments: affected.map(a => ({ code: a.code, startsAt: zoned(a.startAt, PKT), patientName: a.patientName })),
      });
    }
    for (const a of affected) {
      a.status = 'cancelled';
      a.cancelledBy = 'system';
      a.cancelReason = text(body.reason) || 'The doctor is unavailable at this time.';
      settlePaymentOnCancel(a, now);
      addEvent(a, 'cancelled', a.cancelReason, now);
      notifyHealth(db, a.userId, 'health.appointment.cancelled', 'Appointment cancelled', `${displayName(doctor)} is not available then, so ${a.code} was cancelled. Please book another time.`, {
        appointmentCode: a.code,
      });
    }
    const t = {
      id: nextId(h, 'off'),
      doctorId: doctor.id,
      from: dateInZone(start, PKT),
      to: dateInZone(new Date(Math.max(Date.parse(start), Date.parse(end) - MINUTE)).toISOString(), PKT),
      locationId,
      reason: text(body.reason) || null,
    };
    h.timeOff.push(t);
    ctx.setStatus(201);
    return { ...timeOffWire(t), startsAt: start, endsAt: end };
  });
  route('DELETE', '/health/doctor/time-off/:id', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const t = h.timeOff.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.doctorId === doctor.id);
    if (!t) throw notFound('Time off');
    h.timeOff = h.timeOff.filter(x => x.id !== t.id);
    return { removed: true };
  });

  // Payment accounts: `{ kind, accountTitle, accountNumber, bankName? }` (validated as in Shopping).
  const accountInput = (b: Record<string, any>) => {
    const kind = ['raast', 'jazzcash', 'easypaisa', 'bank'].includes(b.kind) ? b.kind : null;
    const fields: Record<string, string> = {};
    if (!kind) fields.kind = 'Choose an account type';
    if (text(b.accountTitle).length < 3) fields.accountTitle = 'Enter the account title';
    const number = text(b.accountNumber).replace(/\s/g, '').toUpperCase();
    if (kind === 'bank' ? !/^PK\d{2}[A-Z]{4}\d{16}$/.test(number) : !/^(\+92|0)3\d{9}$/.test(number)) {
      fields.accountNumber = kind === 'bank' ? 'Enter a 24-character PK IBAN' : 'Enter the mobile number on the account';
    }
    if (kind === 'bank' && text(b.bankName).length < 2) fields.bankName = 'Enter the bank name';
    if (Object.keys(fields).length) throw bad('Check the account.', fields);
    return { kind, title: text(b.accountTitle), number: number.startsWith('0') ? `+92${number.slice(1)}` : number, bankName: kind === 'bank' ? text(b.bankName) : null, isActive: b.isActive !== false };
  };
  const accountWire = (a: MockHealth['paymentAccounts'][string][number]) => ({
    id: a.id,
    kind: a.kind,
    accountTitle: a.title,
    accountNumber: a.number,
    bankName: a.bankName,
    isActive: a.isActive,
    createdAt: null,
  });
  route('GET', '/health/doctor/payment-accounts', ctx => (ctx.db.health.paymentAccounts[myDoctor(ctx).doctor.id] ?? []).map(accountWire));
  route('POST', '/health/doctor/payment-accounts', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const list = (h.paymentAccounts[doctor.id] ??= []);
    if (list.filter(a => a.isActive).length >= 4) throw new HealthError(409, 'CONFLICT', 'You can keep up to 4 active accounts.');
    const acc = { id: nextId(h, 'pa'), ...accountInput(ctx.body) };
    list.push(acc);
    ctx.setStatus(201);
    return accountWire(acc);
  });
  route('PATCH', '/health/doctor/payment-accounts/:id', ctx => {
    const { doctor } = myDoctor(ctx);
    const acc = (ctx.db.health.paymentAccounts[doctor.id] ?? []).find(a => a.id === decodeURIComponent(ctx.params[0]));
    if (!acc) throw notFound('Account');
    Object.assign(acc, accountInput({ kind: acc.kind, accountTitle: acc.title, accountNumber: acc.number, bankName: acc.bankName, isActive: acc.isActive, ...ctx.body }));
    return accountWire(acc);
  });
  route('DELETE', '/health/doctor/payment-accounts/:id', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const before = (h.paymentAccounts[doctor.id] ?? []).length;
    h.paymentAccounts[doctor.id] = (h.paymentAccounts[doctor.id] ?? []).filter(a => a.id !== decodeURIComponent(ctx.params[0]));
    if (h.paymentAccounts[doctor.id].length === before) throw notFound('Account');
    return { removed: true };
  });

  // ══ Doctor: the day ══════════════════════════════════
  const STATUS_RANK: Record<string, number> = { in_progress: 0, checked_in: 1, confirmed: 2, awaiting_payment: 2, completed: 3, no_show: 3 };

  route('GET', '/health/doctor/today', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    if (doctor.id === 'd_bilal') ensureDemoVideo(h, ctx.now);
    const date = todayInZone(PKT, ctx.now);
    const day = h.appointments
      .filter(a => a.doctorId === doctor.id && a.status !== 'cancelled' && dateInZone(a.startAt, PKT) === date)
      .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || (a.checkedInAt ?? a.startAt).localeCompare(b.checkedInAt ?? b.startAt));
    return {
      date,
      counts: {
        total: day.length,
        waiting: day.filter(a => a.status === 'checked_in').length,
        inConsultation: day.filter(a => a.status === 'in_progress').length,
        remaining: day.filter(a => a.status === 'confirmed' || a.status === 'awaiting_payment').length,
        done: day.filter(a => a.status === 'completed' || a.status === 'no_show').length,
      },
      queue: day.map(a => doctorAppointmentWire(h, a, ctx.now)),
    };
  });

  route('GET', '/health/doctor/appointments', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const q = ctx.query;
    const date = DATE.test(String(q.date ?? '')) ? String(q.date) : null;
    const from = DATE.test(String(q.from ?? '')) ? String(q.from) : null;
    const to = DATE.test(String(q.to ?? '')) ? String(q.to) : null;
    const rows = h.appointments
      .filter(a => a.doctorId === doctor.id && a.userId !== 'u_standin_ghost')
      .filter(a => !q.status || STATUS_RANK[a.status] !== undefined || a.status === 'cancelled')
      .filter(a => !q.locationId || a.locationId === q.locationId)
      .filter(a => {
        const d = dateInZone(a.startAt, PKT);
        return (!date || d === date) && (!from || d >= from) && (!to || d <= to);
      })
      .sort(upcomingFirst)
      .map(a => doctorAppointmentWire(h, a, ctx.now));
    return paginate(rows, q);
  });

  route('GET', '/health/doctor/appointments/:code', ctx => {
    const { doctor } = myDoctor(ctx);
    return doctorAppointmentWire(ctx.db.health, doctorAppointment(ctx, doctor), ctx.now, true);
  });

  const act = (pattern: string, run: (ctx: ShopCtx, a: MockAppointment, doctor: MockDoctor) => void) =>
    route('POST', `/health/doctor/appointments/:code/${pattern}`, ctx => {
      const { doctor } = myDoctor(ctx);
      const a = doctorAppointment(ctx, doctor);
      run(ctx, a, doctor);
      return doctorAppointmentWire(ctx.db.health, a, ctx.now);
    });

  act('check-in', (ctx, a) => {
    if (!doctorActions(ctx.db.health, a, ctx.now).canCheckIn) throw transition('This patient can not be checked in now.');
    a.status = 'checked_in';
    a.checkedInAt = isoNow(ctx.now);
    addEvent(a, 'checked_in', null, ctx.now);
  });
  act('start', (ctx, a) => {
    if (!doctorActions(ctx.db.health, a, ctx.now).canStart) throw transition('Check the patient in before starting.');
    a.status = 'in_progress';
    a.startedAt = isoNow(ctx.now);
    if (a.kind === 'video' && !a.checkedInAt) a.checkedInAt = a.startedAt;
    addEvent(a, 'in_progress', null, ctx.now);
  });
  act('no-show', (ctx, a) => {
    if (!doctorActions(ctx.db.health, a, ctx.now).canNoShow) throw transition('This appointment can not be marked as missed yet.');
    a.status = 'no_show';
    settlePaymentOnCancel(a, ctx.now);
    addEvent(a, 'no_show', null, ctx.now);
    notifyHealth(ctx.db, a.userId, 'health.appointment.no_show', 'Marked as missed', `Your appointment ${a.code} was marked as missed. You can book another time.`, {
      appointmentCode: a.code,
    });
  });
  act('complete', (ctx, a, doctor) => {
    if (!doctorActions(ctx.db.health, a, ctx.now).canComplete) throw transition('Start the consultation before completing it.');
    a.status = 'completed';
    a.completedAt = isoNow(ctx.now);
    if (a.paymentMethod === 'pay_at_visit' && bool(ctx.body.paymentCollected)) a.paymentStatus = 'collected';
    addEvent(a, 'completed', null, ctx.now);
    notifyHealth(ctx.db, a.userId, 'health.appointment.completed', 'Visit complete', `Your visit with ${displayName(doctor)} is complete. You can rate it from the appointment.`, {
      appointmentCode: a.code,
    });
  });
  act('cancel', (ctx, a, doctor) => {
    if (!doctorActions(ctx.db.health, a, ctx.now).canCancel) throw transition('This appointment can no longer be cancelled.');
    const reason = text(ctx.body.reason);
    if (reason.length < 3) throw bad('Tell the patient why.', { reason: 'reason must be longer than or equal to 3 characters' });
    a.status = 'cancelled';
    a.cancelledBy = 'doctor';
    a.cancelReason = reason;
    settlePaymentOnCancel(a, ctx.now);
    addEvent(a, 'cancelled', reason, ctx.now);
    notifyHealth(ctx.db, a.userId, 'health.appointment.cancelled', 'Appointment cancelled', `${displayName(doctor)} cancelled ${a.code}: ${reason}`, { appointmentCode: a.code });
  });
  act('payment/confirm', (ctx, a) => {
    if (a.paymentMethod !== 'transfer') throw transition('Mark a clinic fee paid when completing the visit.');
    if (!(a.paymentStatus === 'awaiting_transfer' || a.paymentStatus === 'proof_submitted' || a.paymentStatus === 'proof_rejected')) {
      throw transition('There is no payment to confirm.');
    }
    a.paymentStatus = 'paid';
    addEvent(a, 'payment_confirmed', null, ctx.now);
    if (a.status === 'awaiting_payment') a.status = 'confirmed';
    notifyHealth(ctx.db, a.userId, 'health.payment.confirmed', 'Payment confirmed', `The doctor confirmed your payment for ${a.code}.`, { appointmentCode: a.code });
  });
  act('payment/reject', (ctx, a) => {
    if (a.paymentStatus !== 'proof_submitted' || !a.proof) throw transition('There is no payment to check.');
    const reason = text(ctx.body.reason);
    if (reason.length < 3) throw bad('Tell the patient what was wrong.', { reason: 'reason must be longer than or equal to 3 characters' });
    a.paymentStatus = 'proof_rejected';
    a.proof = { ...a.proof, rejectionReason: reason };
    if (a.instructions && a.status === 'awaiting_payment') {
      a.instructions.payBy = new Date(Math.min(Math.max(Date.parse(a.instructions.payBy), ctx.now + 2 * HOUR), Date.parse(a.startAt))).toISOString();
    }
    addEvent(a, 'payment_rejected', reason, ctx.now);
    notifyHealth(ctx.db, a.userId, 'health.payment.rejected', 'Payment not found', `${a.code}: payment not received — ${reason}`, { appointmentCode: a.code });
  });
  act('refund', (ctx, a) => {
    if (a.paymentStatus !== 'refund_due') throw transition('No refund is due on this appointment.');
    if (text(ctx.body.refundRef).length < 3) throw bad('Enter the refund reference.', { refundRef: 'refundRef must be longer than or equal to 3 characters' });
    a.paymentStatus = 'refunded';
    addEvent(a, 'refunded', text(ctx.body.refundRef), ctx.now);
  });

  route('GET', '/health/doctor/appointments/:code/notes', ctx => notesWire(doctorAppointment(ctx, myDoctor(ctx).doctor)));
  route('PUT', '/health/doctor/appointments/:code/notes', ctx => {
    const { doctor } = myDoctor(ctx);
    const a = doctorAppointment(ctx, doctor);
    const t = typeof ctx.body.text === 'string' ? ctx.body.text : '';
    if (t.length > 5000) throw bad('Keep notes under 5,000 characters.', { text: 'text must be shorter than or equal to 5000 characters' });
    a.notes = {
      text: t,
      attachments: (Array.isArray(ctx.body.files) ? ctx.body.files : []).map((f: any) => f?.url).filter((u: unknown) => typeof u === 'string').slice(0, 10),
      updatedAt: isoNow(ctx.now),
    };
    return notesWire(a);
  });
  route('POST', '/health/doctor/appointments/:code/video/join', ctx => {
    const { doctor } = myDoctor(ctx);
    const a = doctorAppointment(ctx, doctor);
    joinCheck({ ...a, status: a.status === 'awaiting_payment' ? 'confirmed' : a.status }, ctx.now);
    // The doctor's join starts the consultation.
    if (a.status === 'confirmed' || a.status === 'awaiting_payment') {
      a.status = 'in_progress';
      a.startedAt = isoNow(ctx.now);
      a.checkedInAt ??= a.startedAt;
      addEvent(a, 'in_progress', null, ctx.now);
    }
    const name = displayName(doctor);
    return videoJoinWire(a, roomUrl(a, name), name, true);
  });
  route('GET', '/health/doctor/appointments/:code/records/:recordId', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const a = doctorAppointment(ctx, doctor);
    const id = decodeURIComponent(ctx.params[1]);
    const r = a.recordIds.includes(id) ? h.records.find(x => x.id === id) : null;
    if (!r) throw notFound('Record');
    return recordWire(h, r, ctx.now);
  });

  // ══ Doctor: prescriptions ════════════════════════════
  route('GET', '/health/doctor/appointments/:code/prescription', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const a = doctorAppointment(ctx, doctor);
    const p = a.prescriptionId ? h.prescriptions.find(x => x.id === a.prescriptionId) : null;
    return { prescription: p ? prescriptionWire(h, p, ctx.now) : null, locked: !prescriptionOpen(a, ctx.now) };
  });
  route('POST', '/health/doctor/appointments/:code/prescription', ctx => {
    const { db, now } = ctx;
    const { doctor } = myDoctor(ctx);
    const h = db.health;
    const a = doctorAppointment(ctx, doctor);
    if (!prescriptionOpen(a, now)) {
      throw new HealthError(409, 'PRESCRIPTION_LOCKED', a.status === 'completed' ? 'Prescriptions can be changed for 24 hours after the visit.' : 'Start the consultation before writing a prescription.', {
        reason: a.status === 'completed' ? 'window_closed' : 'not_in_consultation',
      });
    }
    const input = prescriptionFromBody(ctx.body);
    let p = a.prescriptionId ? h.prescriptions.find(x => x.id === a.prescriptionId) : null;
    if (p) Object.assign(p, input);
    else {
      p = { id: nextId(h, 'rx'), appointmentId: a.id, doctorId: doctor.id, issuedAt: isoNow(now), ...input };
      h.prescriptions.push(p);
      a.prescriptionId = p.id;
      const fav = (h.favourites[doctor.id] ??= []);
      for (const m of input.medicines) if (!fav.some(f => f.name === m.name && f.strength === m.strength)) fav.push({ name: m.name, strength: m.strength, form: m.form });
    }
    notifyHealth(db, a.userId, 'health.prescription', 'Your prescription is ready', `${displayName(doctor)} wrote a prescription for ${a.patientName}.`, {
      prescriptionId: p.id,
      appointmentCode: a.code,
    });
    ctx.setStatus(201);
    return prescriptionWire(h, p, now);
  });
  route('GET', '/health/doctor/prescriptions/:id', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const p = h.prescriptions.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.doctorId === doctor.id);
    if (!p) throw notFound('Prescription');
    return prescriptionWire(h, p, ctx.now);
  });
  route('GET', '/health/doctor/medicines/suggest', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const q = text(ctx.query.q);
    const fav = (h.favourites[doctor.id] ?? []).filter(m => !q || matches(q, m.name));
    const rest = h.formulary.filter(m => !!q && matches(q, m.name) && !fav.some(f => f.name === m.name && f.strength === m.strength));
    return {
      medicines: [
        ...fav.map(m => ({ source: 'favourite', name: m.name, strength: m.strength, form: m.form, dosePattern: null, timing: null, useCount: 1 })),
        ...rest.map(m => ({ source: 'reference', name: m.name, strength: m.strength, form: m.form, dosePattern: null, timing: null, useCount: 0 })),
      ].slice(0, 15),
    };
  });
  route('GET', '/health/doctor/diagnoses/recent', ctx => {
    const { doctor } = myDoctor(ctx);
    const seen: string[] = [];
    for (const p of [...ctx.db.health.prescriptions].filter(x => x.doctorId === doctor.id).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))) {
      if (!seen.some(s => s.toLowerCase() === p.diagnosis.toLowerCase())) seen.push(p.diagnosis);
    }
    return seen.slice(0, 10);
  });

  // ══ Doctor: patients, reviews, insights ══════════════
  const personRow = (h: MockHealth, list: MockAppointment[], now: number) => {
    const latest = [...list].sort(latestFirst)[0];
    const member = latest.familyMemberId ? h.family.find(f => f.id === latest.familyMemberId) : null;
    return {
      patientKey: patientKey(latest),
      name: latest.patientName,
      gender: latest.patientGender,
      age: ageFrom(latest.patientDob, now),
      phone: latest.patientPhone,
      relation: member?.relation ?? null,
      visits: list.length,
      completedVisits: list.filter(a => a.status === 'completed').length,
      lastVisitAt: zoned(latest.startAt, PKT),
    };
  };

  route('GET', '/health/doctor/patients', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const q = text(ctx.query.q);
    const groups = new Map<string, MockAppointment[]>();
    for (const a of h.appointments) {
      if (a.doctorId !== doctor.id || a.userId === 'u_standin_ghost') continue;
      groups.set(patientKey(a), [...(groups.get(patientKey(a)) ?? []), a]);
    }
    const rows = [...groups.values()]
      .map(list => personRow(h, list, ctx.now))
      .filter(p => !q || matches(q, p.name, p.phone))
      .sort((a, b) => String(b.lastVisitAt).localeCompare(String(a.lastVisitAt)));
    return paginate(rows, ctx.query);
  });
  route('GET', '/health/doctor/patients/:key', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const key = decodeURIComponent(ctx.params[0]);
    const theirs = h.appointments.filter(a => a.doctorId === doctor.id && patientKey(a) === key).sort(latestFirst);
    if (!theirs.length) throw notFound('Patient');
    const person: Partial<ReturnType<typeof personRow>> = personRow(h, theirs, ctx.now);
    // The history leaves out the list row's counts.
    delete person.completedVisits;
    delete person.lastVisitAt;
    return {
      ...person,
      previousAppointments: theirs.map(o => ({ code: o.code, startsAt: zoned(o.startAt, PKT), status: o.status === 'in_progress' ? 'in_consultation' : o.status === 'awaiting_payment' || o.status === 'confirmed' ? 'booked' : o.status, kind: o.kind, reason: o.reason })),
      prescriptions: theirs
        .filter(o => o.prescriptionId)
        .map(o => {
          const p = h.prescriptions.find(x => x.id === o.prescriptionId)!;
          return { id: p.id, issuedAt: p.issuedAt, diagnosis: p.diagnosis, appointmentCode: o.code };
        }),
    };
  });

  route('GET', '/health/doctor/reviews', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const stars = num(ctx.query.rating);
    const rows = h.reviews
      .filter(r => r.doctorId === doctor.id)
      .filter(r => !bool(ctx.query.unreplied) || !r.reply)
      .filter(r => stars === null || r.rating === stars)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(r => reviewWire(h, r, { owner: true }));
    return paginate(rows, ctx.query);
  });
  route('GET', '/health/doctor/reviews/summary', ctx => summaryWire(ctx.db.health, myDoctor(ctx).doctor.id));
  route('POST', '/health/doctor/reviews/:id/reply', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const r = h.reviews.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.doctorId === doctor.id);
    if (!r) throw notFound('Review');
    const t = text(ctx.body.text);
    if (t.length < 2 || t.length > 1000) throw bad('Write a reply.', { text: 'text must be 2 to 1000 characters' });
    // Public, and it replaces an earlier reply.
    r.reply = { text: t, createdAt: isoNow(ctx.now) };
    return reviewWire(h, r, { owner: true });
  });

  route('GET', '/health/doctor/insights', ctx => {
    const { doctor } = myDoctor(ctx);
    const h = ctx.db.health;
    const range = ['7d', '30d', '90d'].includes(ctx.query.range) ? String(ctx.query.range) : '7d';
    const n = Number(range.replace('d', ''));
    const to = todayInZone(PKT, ctx.now);
    const from = addDays(to, -(n - 1));
    const inRange = h.appointments.filter(a => a.doctorId === doctor.id && a.userId !== 'u_standin_ghost' && pkDay(a.startAt) >= from && pkDay(a.startAt) <= to);
    const perDay = Array.from({ length: n }, (_, i) => {
      const date = addDays(from, i);
      const day = inRange.filter(a => pkDay(a.startAt) === date && a.status !== 'cancelled');
      const video = day.filter(a => a.kind === 'video').length;
      const clinic = day.filter(a => a.kind === 'clinic').length;
      return { date, clinic, video, total: video + clinic };
    });
    const done = inRange.filter(a => a.status === 'completed');
    const waits = done.filter(a => a.kind === 'clinic' && a.checkedInAt && a.startedAt).map(a => (Date.parse(a.startedAt!) - Date.parse(a.checkedInAt!)) / MINUTE);
    const consults = done.filter(a => a.startedAt && a.completedAt).map(a => (Date.parse(a.completedAt!) - Date.parse(a.startedAt!)) / MINUTE);
    const mean = (xs: number[]) => (xs.length >= 3 ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
    const cancelled = inRange.filter(a => a.status === 'cancelled');
    const noShow = inRange.filter(a => a.status === 'no_show').length;
    const settled = done.length + cancelled.length + noShow;
    const reviews = visibleReviews(h, doctor.id).filter(r => pkDay(r.createdAt) >= from);
    const trend = new Map<string, number[]>();
    for (const r of reviews) trend.set(pkDay(r.createdAt), [...(trend.get(pkDay(r.createdAt)) ?? []), r.rating]);
    const fee = (pred: (a: MockAppointment) => boolean) => inRange.filter(pred).reduce((s, a) => s + a.fee, 0);
    return {
      range,
      from,
      to,
      timezone: PKT,
      perDay,
      totals: {
        appointments: inRange.length,
        completed: done.length,
        cancelled: cancelled.length,
        lateCancelled: cancelled.filter(a => a.lateCancel).length,
        cancelledByDoctor: cancelled.filter(a => a.cancelledBy === 'doctor').length,
        noShow,
        upcoming: inRange.filter(a => isActive(a)).length,
      },
      rates: {
        completion: settled ? Math.round((done.length / settled) * 1000) / 1000 : 0,
        cancellation: settled ? Math.round((cancelled.length / settled) * 1000) / 1000 : 0,
        noShow: settled ? Math.round((noShow / settled) * 1000) / 1000 : 0,
      },
      times: { avgWaitMinutes: mean(waits), waitSamples: waits.length, avgConsultMinutes: mean(consults), consultSamples: consults.length },
      patients: {
        new: new Set(done.filter(a => !h.appointments.some(o => o.id !== a.id && o.doctorId === a.doctorId && patientKey(o) === patientKey(a) && o.status === 'completed' && o.startAt < a.startAt)).map(patientKey)).size,
        returning: new Set(done.filter(a => h.appointments.some(o => o.id !== a.id && o.doctorId === a.doctorId && patientKey(o) === patientKey(a) && o.status === 'completed' && o.startAt < a.startAt)).map(patientKey)).size,
      },
      fees: {
        label: 'Recorded by you — MetroMatrix does not process or hold payments.',
        recorded: fee(a => a.status === 'completed' && (a.paymentStatus === 'collected' || a.paymentStatus === 'paid')),
        atClinic: fee(a => a.status === 'completed' && a.paymentStatus === 'collected'),
        byTransfer: fee(a => a.paymentStatus === 'paid'),
        refundDue: fee(a => a.paymentStatus === 'refund_due'),
        refunded: fee(a => a.paymentStatus === 'refunded'),
      },
      ratingTrend: [...trend.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, rs]) => ({ date, reviews: rs.length, average: Math.round((rs.reduce((s, x) => s + x, 0) / rs.length) * 10) / 10 })),
    };
  });

  // ══ Admin ════════════════════════════════════════════
  route('GET', '/admin/health/overview', ctx => {
    requireAdmin(ctx);
    const { db, now } = ctx;
    const h = db.health;
    const today = todayInZone(PKT, now);
    const listed = h.doctors.filter(d => d.isListed);
    const by = new Map<string, { slug: string; name: string; doctors: number }>();
    for (const d of listed) {
      const s = specialtyBySlug(h, d.specialtySlug);
      if (!s) continue;
      const e = by.get(s.slug) ?? { slug: s.slug, name: s.name, doctors: 0 };
      e.doctors += 1;
      by.set(s.slug, e);
    }
    const real = h.appointments.filter(a => a.userId !== 'u_standin_ghost');
    const events = real.flatMap(a => a.events);
    const doctorBusinesses = db.businesses.filter(b => b.subType === 'doctor');
    const statusCount: Record<string, number> = {};
    for (const a of real.filter(a => pkDay(a.startAt) === today)) {
      const s = a.status === 'in_progress' ? 'in_consultation' : a.status === 'confirmed' || a.status === 'awaiting_payment' ? 'booked' : a.status;
      statusCount[s] = (statusCount[s] ?? 0) + 1;
    }
    return {
      date: today,
      doctors: {
        total: doctorBusinesses.length,
        listed: listed.length,
        awaitingPmdc: doctorBusinesses.filter(b => b.status === 'pending_approval' && !b.pmdcVerified).length,
        unlistedByAdmin: 0,
      },
      listedBySpecialty: [...by.values()].sort((a, b) => b.doctors - a.doctors),
      today: {
        newBookings: real.filter(a => pkDay(a.createdAt) === today).length,
        cancellations: events.filter(e => e.type === 'cancelled' && pkDay(e.createdAt) === today).length,
        noShows: events.filter(e => e.type === 'no_show' && pkDay(e.createdAt) === today).length,
        appointmentsByStatus: statusCount,
      },
      last7Days: {},
      reviews: { total: h.reviews.length, hidden: h.reviews.filter(r => r.isHidden).length, last7Days: 0 },
      symptomChecks: { last24h: 0, emergencies24h: 0 },
      topSpecialties30d: [],
    };
  });

  const adminSpecialtyWire = (h: MockHealth, s: MockHealth['specialties'][number]) => {
    const { doctorCount, ...rest } = specialtyWire(h, s, null);
    return { ...rest, keywords: [], sort: s.sort, isActive: s.isActive !== false, doctors: doctorCount };
  };
  route('GET', '/admin/health/specialties', ctx => {
    requireAdmin(ctx);
    const h = ctx.db.health;
    return [...h.specialties].sort((a, b) => a.sort - b.sort).map(s => adminSpecialtyWire(h, s));
  });
  route('POST', '/admin/health/specialties', ctx => {
    requireAdmin(ctx);
    const h = ctx.db.health;
    const b = ctx.body;
    const name = text(b.name);
    const fields: Record<string, string> = {};
    if (name.length < 2) fields.name = 'name must be longer than or equal to 2 characters';
    if (!text(b.nameUr)) fields.nameUr = 'nameUr should not be empty';
    if (!Array.isArray(b.keywords)) fields.keywords = 'keywords must be an array';
    if (Object.keys(fields).length) throw bad('Check the specialty.', fields);
    const slug = text(b.slug) || slugify(name);
    if (h.specialties.some(s => s.slug === slug)) throw new HealthError(409, 'CONFLICT', 'Another specialty already uses this slug.', { fields: { slug: ['already used'] } });
    const s = { id: `sp_${slug}`, slug, name, nameUr: text(b.nameUr), icon: iconKey(text(b.icon) || null) ?? 'stethoscope', sort: Math.round(Number(b.sort) || 99), isActive: true };
    h.specialties.push(s);
    ctx.setStatus(201);
    return adminSpecialtyWire(h, s);
  });
  route('PATCH', '/admin/health/specialties/:id', ctx => {
    requireAdmin(ctx);
    const h = ctx.db.health;
    const s = h.specialties.find(x => x.id === decodeURIComponent(ctx.params[0]));
    if (!s) throw notFound('Specialty');
    const b = ctx.body;
    if (b.name !== undefined && text(b.name).length >= 2) s.name = text(b.name);
    if (b.icon !== undefined) s.icon = iconKey(text(b.icon) || null) ?? s.icon;
    if (b.sort !== undefined) s.sort = Math.round(Number(b.sort));
    if (b.isActive !== undefined) s.isActive = !!b.isActive;
    return adminSpecialtyWire(h, s);
  });

  const adminConditionWire = (h: MockHealth, c: MockHealth['conditions'][number]) => ({
    id: c.id,
    name: c.name,
    nameUr: c.nameUr,
    slug: c.slug,
    aliases: c.aliases,
    isCommon: c.isCommon,
    icon: iconKey(c.icon),
    isActive: c.isActive !== false,
    specialties: (() => {
      const s = c.specialtySlug ? specialtyBySlug(h, c.specialtySlug) : null;
      return s ? [{ id: s.id, name: s.name, slug: s.slug, rank: 1 }] : [];
    })(),
  });
  route('GET', '/admin/health/conditions', ctx => {
    requireAdmin(ctx);
    const h = ctx.db.health;
    const q = text(ctx.query.q);
    const rows = h.conditions.filter(c => !q || matches(q, c.name, c.slug, ...c.aliases)).sort((a, b) => a.name.localeCompare(b.name));
    return paginate(rows.map(c => adminConditionWire(h, c)), ctx.query);
  });
  route('POST', '/admin/health/conditions', ctx => {
    requireAdmin(ctx);
    const h = ctx.db.health;
    const b = ctx.body;
    const name = text(b.name);
    if (name.length < 2) throw bad('Check the condition.', { name: 'name must be longer than or equal to 2 characters' });
    const slug = text(b.slug) || slugify(name);
    if (h.conditions.some(c => c.slug === slug)) throw new HealthError(409, 'CONFLICT', 'Another condition already uses this slug.', { fields: { slug: ['already used'] } });
    const c = {
      id: `cn_${slug}`,
      slug,
      name,
      nameUr: text(b.nameUr) || null,
      specialtySlug: null,
      isCommon: !!b.isCommon,
      icon: iconKey(text(b.icon) || null),
      isActive: true,
      aliases: (Array.isArray(b.aliases) ? b.aliases : []).map(text).filter(Boolean).slice(0, 40),
    };
    h.conditions.push(c);
    ctx.setStatus(201);
    return adminConditionWire(h, c);
  });
  route('PATCH', '/admin/health/conditions/:id', ctx => {
    requireAdmin(ctx);
    const h = ctx.db.health;
    const c = h.conditions.find(x => x.id === decodeURIComponent(ctx.params[0]));
    if (!c) throw notFound('Condition');
    const b = ctx.body;
    if (b.name !== undefined && text(b.name).length >= 2) c.name = text(b.name);
    if (Array.isArray(b.aliases)) c.aliases = b.aliases.map(text).filter(Boolean).slice(0, 40);
    if (b.isCommon !== undefined) c.isCommon = !!b.isCommon;
    if (b.icon !== undefined) c.icon = iconKey(text(b.icon) || null);
    if (b.isActive !== undefined) c.isActive = !!b.isActive;
    return adminConditionWire(h, c);
  });
  route('PUT', '/admin/health/conditions/:id/specialties', ctx => {
    requireAdmin(ctx);
    const h = ctx.db.health;
    const c = h.conditions.find(x => x.id === decodeURIComponent(ctx.params[0]));
    if (!c) throw notFound('Condition');
    const list = (Array.isArray(ctx.body) ? ctx.body : []) as { specialtyId: string; rank: number }[];
    const first = [...list].sort((a, b) => Number(a.rank) - Number(b.rank))[0];
    const s = first ? h.specialties.find(x => x.id === first.specialtyId) : null;
    if (first && !s) throw notFound('Specialty');
    c.specialtySlug = s?.slug ?? null;
    return adminConditionWire(h, c);
  });

  /** A doctor row of the staff list; in the dummy API it carries its business's id. */
  const adminDoctorWire = (db: MockDb, b: MockBusiness) => {
    const h = db.health;
    const d = h.doctors.find(x => x.businessId === b.id) ?? null;
    const p = h.pmdc[b.id];
    const spec = d ? specialtyRefWire(h, d.specialtySlug) : h.specialties.find(s => norm(s.name) === norm(b.details?.specialty ?? '')) ?? null;
    return {
      id: b.id,
      title: d ? Object.entries(TITLE_LABEL).find(([, l]) => l === d.title)?.[0] ?? 'dr' : 'dr',
      fullName: d?.name ?? db.users.find(u => u.id === b.ownerId)?.name?.replace(/^dr\.?\s+/i, '') ?? b.name,
      pmdcNumber: b.details?.pmdcNumber || d?.pmdcNumber || `UNSET-${b.id}`,
      pmdcVerifiedAt: b.pmdcVerified ? (p?.at ?? b.submittedAt ?? null) : null,
      isListed: !!d?.isListed,
      unlistedReason: null,
      specialty: spec ? { id: spec.id, name: spec.name, slug: spec.slug } : null,
      documents: b.documents.map(doc => ({ id: doc.id, kind: doc.kind, url: doc.url, status: 'pending' })),
      business: { id: b.id, name: b.name, status: b.status, city: b.city, submittedAt: b.submittedAt },
    };
  };
  route('GET', '/admin/health/doctors', ctx => {
    requireAdmin(ctx);
    const q = ctx.query;
    const rows = ctx.db.businesses
      .filter(b => b.subType === 'doctor')
      .filter(b => !q.businessId || b.id === q.businessId)
      .filter(b => q.pmdc !== 'unverified' || !b.pmdcVerified)
      .filter(b => q.pmdc !== 'verified' || !!b.pmdcVerified)
      .filter(b => !q.q || matches(String(q.q), b.name, b.details?.pmdcNumber))
      .sort((a, b) => Number(!!a.pmdcVerified) - Number(!!b.pmdcVerified) || (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''))
      .map(b => adminDoctorWire(ctx.db, b));
    return paginate(rows, q);
  });
  route('POST', '/admin/health/doctors/:id/pmdc-verify', ctx => {
    requireAdmin(ctx);
    const b = ctx.db.businesses.find(x => x.id === decodeURIComponent(ctx.params[0]) && x.subType === 'doctor');
    if (!b) throw notFound('Doctor');
    if (!b.details?.pmdcNumber) throw new HealthError(409, 'CONFLICT', 'This doctor has not given a PMDC number yet.');
    b.pmdcVerified = true;
    ctx.db.health.pmdc[b.id] = { verified: true, note: text(ctx.body.note) || null, at: isoNow(ctx.now) };
    return { id: b.id, pmdcNumber: b.details.pmdcNumber, pmdcVerified: true };
  });

  route('GET', '/admin/health/reviews', ctx => {
    requireAdmin(ctx);
    const h = ctx.db.health;
    const q = ctx.query;
    const rows = h.reviews
      .filter(r => !q.doctorId || r.doctorId === q.doctorId)
      .filter(r => q.hidden === undefined || r.isHidden === bool(q.hidden))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(r => reviewWire(h, r, { staff: true }));
    return paginate(rows, q);
  });
  const moderate = (hide: boolean) => (ctx: ShopCtx) => {
    requireAdmin(ctx);
    const h = ctx.db.health;
    const r = h.reviews.find(x => x.id === decodeURIComponent(ctx.params[0]));
    if (!r) throw notFound('Review');
    if (hide && text(ctx.body.reason).length < 3) throw bad('Give a reason.', { reason: 'reason must be longer than or equal to 3 characters' });
    r.isHidden = hide;
    r.hiddenReason = hide ? text(ctx.body.reason) : null;
    return reviewWire(h, r, { staff: true });
  };
  route('POST', '/admin/health/reviews/:id/hide', moderate(true));
  route('POST', '/admin/health/reviews/:id/unhide', moderate(false));

  route('GET', '/admin/health/appointments/:code', ctx => {
    requireAdmin(ctx);
    const h = ctx.db.health;
    const a = h.appointments.find(x => x.code === decodeURIComponent(ctx.params[0]).toUpperCase());
    if (!a) throw notFound('Appointment');
    // Staff see booking facts only: no prescription id, notes or records.
    return adminAppointmentWire(h, a, ctx.now);
  });

  // The dummy API's home-only helpers, for the seed's demo checks.
  void earliestOf;
  void servesCity;
  void patientFlags;
}
