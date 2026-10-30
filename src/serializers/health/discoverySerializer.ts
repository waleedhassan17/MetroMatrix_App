// ═══════════════════════════════════════════════════════
// MetroMatrix — Discovery serializers (home, specialties, conditions,
// doctors and their profiles, slots, reviews)
// ═══════════════════════════════════════════════════════
// Shapes: MetroMatrix-API docs/API_HEALTH.md §2 and §4.1.

import type {
  BookingRules,
  Condition,
  DayAvailability,
  DoctorBadge,
  DoctorCardData,
  DoctorProfile,
  DoctorReview,
  DoctorReviewSummary,
  ExperienceRow,
  HealthBanner,
  HealthBannerTarget,
  HealthHome,
  HealthSuggestions,
  PracticeLocation,
  Qualification,
  ReviewDimension,
  Slot,
  SlotDay,
  SlotPeriod,
  Specialty,
  TimingRow,
} from '../../types/health';
import { arr, bodiesOf, bool, isObject, num, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { compact, count, iso, money, paged } from '../shopping/common';
import { reviewTagLabel } from '../../models/health/reviewFormModel';
import {
  KINDS,
  TITLE_PREFIX,
  availabilitySerializer,
  dayOrNull,
  doctorName,
  emergencyNumbersSerializer,
  gender,
  iconGlyph,
  iconGlyphOrNull,
  instant,
  numOrNull,
  rating,
  specialtyRefSerializer,
  strings,
  timezone,
} from './healthCommon';
import { appointmentSummarySerializer } from './appointmentSerializer';

const PERIODS: readonly SlotPeriod[] = ['morning', 'afternoon', 'evening', 'night'];
const DIMENSIONS: readonly ReviewDimension[] = ['diagnosis', 'staff', 'environment'];
const DIMENSION_LABEL: Record<ReviewDimension, string> = { diagnosis: 'Diagnosis', staff: 'Staff', environment: 'Clinic environment' };

export const specialtySerializer = (raw: unknown): Specialty | null => {
  if (!isObject(raw)) return null;
  const slug = str(raw.slug);
  if (!slug) return null;
  return {
    id: str(raw.id, slug),
    slug,
    name: str(raw.name, slug),
    nameUr: str(raw.nameUr),
    icon: iconGlyph(raw.icon),
    // `doctors` on the staff list.
    doctorCount: count(raw.doctorCount ?? raw.doctors),
  };
};

/** A condition's first-choice specialty is the first of its ranked `specialties`. */
export const conditionSerializer = (raw: unknown): Condition | null => {
  if (!isObject(raw)) return null;
  const slug = str(raw.slug);
  if (!slug) return null;
  const first = arr(raw.specialties).find(isObject);
  return {
    id: str(raw.id, slug),
    slug,
    name: str(raw.name, slug),
    nameUr: strOrNull(raw.nameUr),
    specialtySlug: strOrNull(raw.specialtySlug) ?? (first ? strOrNull(first.slug) : null),
    isCommon: bool(raw.isCommon),
    icon: iconGlyphOrNull(raw.icon),
  };
};

const badgesOf = (raw: Record<string, unknown>): DoctorBadge[] => {
  const b = isObject(raw.badges) ? raw.badges : {};
  const out: DoctorBadge[] = [];
  if (bool(raw.pmdcVerified) || bool(b.pmdcVerified)) out.push('pmdc_verified');
  if (bool(raw.isTopBooked) || bool(b.topBooked)) out.push('top_booked');
  return out;
};

export const doctorCardSerializer = (raw: unknown): DoctorCardData | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const reviews = count(raw.ratingCount);
  return {
    id,
    name: doctorName(raw),
    photoUrl: strOrNull(raw.photoUrl),
    gender: gender(raw.gender),
    specialty: specialtyRefSerializer(raw.specialty),
    qualifications: str(raw.qualifications),
    yearsExperience: Math.max(0, Math.round(num(raw.yearsExperience))),
    // An average of no reviews is no rating.
    rating: reviews > 0 ? rating(raw.ratingAvg) : null,
    reviewCount: reviews,
    waitMinutes: numOrNull(raw.avgWaitMinutes),
    badges: badgesOf(raw),
    offersVideo: bool(raw.offersVideo),
    offersClinic: bool(raw.offersClinic),
    fromFee: money(raw.minFee),
    availability: availabilitySerializer(raw.nextAvailable),
    city: str(raw.city),
  };
};

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * `timings: [{ weekday, weekdayLabel, ranges: [{ label }] }]` → rows of days
 * that share the same hours ("Mon, Wed, Fri" · "5:00 PM – 9:00 PM"), Monday first.
 */
export const timingsSerializer = (raw: unknown): TimingRow[] => {
  const days = compact(
    arr(raw).map(d =>
      isObject(d) && str(d.weekdayLabel)
        ? {
            weekday: Math.round(num(d.weekday)),
            label: str(d.weekdayLabel),
            hours: compact(arr(d.ranges).map(r => (isObject(r) ? strOrNull(r.label) : null))).join(', '),
          }
        : null,
    ),
  )
    .filter(d => d.hours)
    .sort((a, b) => WEEK_ORDER.indexOf(a.weekday) - WEEK_ORDER.indexOf(b.weekday));
  const rows: TimingRow[] = [];
  for (const d of days) {
    const row = rows.find(r => r.hours === d.hours);
    if (row) row.days = `${row.days}, ${d.label}`;
    else rows.push({ days: d.label, hours: d.hours });
  }
  return rows;
};

/**
 * A practice location: the public profile's (with `nextAvailable` and
 * `timings`) or the doctor's own list row (with `nextAvailableAt`).
 * `prepay` is the doctor's video rule (a profile-level setting).
 */
export const locationSerializer = (raw: unknown, prepay = false): PracticeLocation | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const kind = oneOf(raw.kind, KINDS, 'clinic');
  const availability = isObject(raw.nextAvailable)
    ? availabilitySerializer(raw.nextAvailable)
    : { label: null, today: false, nextAt: instant(raw.nextAvailableAt) };
  return {
    id,
    kind,
    name: str(raw.name, kind === 'video' ? 'Video consultation' : 'Clinic'),
    area: str(raw.area),
    city: str(raw.city),
    address: strOrNull(raw.addressLine),
    lat: numOrNull(raw.lat),
    lng: numOrNull(raw.lng),
    phone: strOrNull(raw.phone),
    fee: money(raw.fee),
    slotMinutes: Math.max(5, Math.round(num(raw.slotMinutes, 15))),
    instructions: strOrNull(raw.instructions),
    timezone: timezone(raw.timezone),
    availability,
    timings: timingsSerializer(raw.timings),
    requiresPrepay: kind === 'video' && prepay,
  };
};

const qualificationSerializer = (raw: unknown): Qualification | null =>
  isObject(raw) && str(raw.degree) ? { degree: str(raw.degree), institute: str(raw.institute), year: numOrNull(raw.year) } : null;

export const experienceSerializer = (raw: unknown): ExperienceRow | null =>
  isObject(raw) && str(raw.designation)
    ? { role: str(raw.designation), place: str(raw.institute), from: numOrNull(raw.fromYear), to: numOrNull(raw.toYear) }
    : null;

/** `{ count, averages, satisfactionPct, distribution, topTags }` → the summary card. */
export const reviewSummarySerializer = fromResponse((raw: unknown): DoctorReviewSummary => {
  const r = isObject(raw) ? raw : {};
  const a = isObject(r.averages) ? r.averages : {};
  const dist = arr(r.distribution).map(count);
  return {
    average: rating(a.overall),
    count: count(r.count),
    recommendPct: numOrNull(r.satisfactionPct),
    distribution: [0, 1, 2, 3, 4].map(i => dist[i] ?? 0),
    dimensions: DIMENSIONS.map(key => ({ key, label: DIMENSION_LABEL[key], score: rating(a[key]) })).filter(d => d.score !== null),
    tags: compact(
      arr(r.topTags).map(t => (isObject(t) && str(t.tag) ? { label: reviewTagLabel(str(t.tag)), count: count(t.count) } : null)),
    ),
  };
});

/** A review: the public one, or the doctor's and staff's (hidden flags, names). */
export const doctorReviewSerializer = fromResponse((raw: unknown): DoctorReview | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const reply = isObject(raw.reply) && str(raw.reply.text) ? { text: str(raw.reply.text), createdAt: iso(raw.reply.at) } : null;
  return {
    id,
    authorName: str(raw.author, 'Patient'),
    rating: Math.min(5, Math.max(1, Math.round(num(raw.overall, 5)))),
    kind: oneOf(raw.kind, KINDS, 'clinic'),
    tags: strings(raw.tags).map(reviewTagLabel),
    text: strOrNull(raw.text),
    recommend: typeof raw.recommend === 'boolean' ? raw.recommend : null,
    createdAt: iso(raw.createdAt),
    reply,
    isHidden: bool(raw.hidden) || !!strOrNull(raw.hiddenAt),
    // A reply can always be changed (API_HEALTH §4.3: it replaces the earlier one).
    replyEditableUntil: null,
    doctorName: strOrNull(raw.doctorName),
  };
});

const bookingRulesSerializer = (raw: unknown): BookingRules => {
  const r = isObject(raw) ? raw : {};
  return {
    windowDays: count(r.bookingWindowDays) || 14,
    // Not on the public profile; the slots already respect it.
    minNoticeMinutes: count(r.minNoticeMinutes),
    cancelCutoffHours: Math.round((count(r.cancelCutoffMinutes) / 60) * 10) / 10,
    videoPrepay: bool(r.videoPrepayRequired),
  };
};

/**
 * `GET /health/doctors/:id` (+ `similar`, which the network fetches with it).
 * Video comes first among the locations, the way patients choose.
 */
export const doctorProfileSerializer = (raw: unknown): DoctorProfile | null => {
  const card = doctorCardSerializer(raw);
  if (!card || !isObject(raw)) return null;
  const rules = bookingRulesSerializer(raw.booking);
  const stats = isObject(raw.stats) ? raw.stats : {};
  const summary = isObject(raw.reviewSummary) ? raw.reviewSummary : {};
  const locations = compact(arr(raw.locations).map(l => locationSerializer(l, rules.videoPrepay))).sort(
    (a, b) => Number(b.kind === 'video') - Number(a.kind === 'video'),
  );
  return {
    ...card,
    title: TITLE_PREFIX[str(raw.title)] ?? 'Dr.',
    about: str(raw.about),
    languages: strings(raw.languages),
    services: strings(raw.services),
    conditions: compact(arr(raw.conditions).map(c => (isObject(c) && str(c.slug) ? { slug: str(c.slug), name: str(c.name) } : null))),
    qualificationList: compact(arr(raw.qualificationList).map(qualificationSerializer)),
    experienceList: compact(arr(raw.experiences).map(experienceSerializer)),
    locations,
    stats: {
      satisfactionPct: numOrNull(stats.satisfactionPct),
      waitMinutes: numOrNull(stats.avgWaitMinutes),
      timeWithPatientMinutes: numOrNull(stats.avgConsultMinutes),
      reviewCount: count(stats.ratingCount ?? card.reviewCount),
    },
    reviewSummary: reviewSummarySerializer(summary),
    topReviews: compact(arr(summary.latest).map(doctorReviewSerializer)),
    similar: compact(arr(raw.similar).map(doctorCardSerializer)).filter(d => d.id !== card.id),
    bookingRules: rules,
    city: card.city || locations.find(l => l.kind === 'clinic')?.city || '',
  };
};

// ─── Slots: `{ location, days: [{ date, slots: [{ startsAt, period }] }] }` ──
const slotSerializer = (raw: unknown): Slot | null => {
  if (!isObject(raw)) return null;
  const startAt = instant(raw.startsAt);
  return startAt ? { startAt, period: oneOf(raw.period, PERIODS, 'morning') } : null;
};

const slotDays = (raw: unknown) =>
  compact(
    arr(isObject(raw) ? raw.days : raw).map(d => {
      if (!isObject(d)) return null;
      const date = dayOrNull(d.date);
      return date ? { date, slots: compact(arr(d.slots).map(slotSerializer)) } : null;
    }),
  );

/** The day chips: each day and how many free times it has. */
export const daysSerializer = fromResponse((raw: unknown): DayAvailability[] => slotDays(raw).map(d => ({ date: d.date, slotCount: d.slots.length })));

export const slotsSerializer = (raw: unknown): Slot[] => slotDays(raw).flatMap(d => d.slots);

/** The first day's slots; when it has none, the next day that does (the network asks for a fortnight). */
export const slotDaySerializer = fromResponse((raw: unknown): SlotDay | null => {
  const days = slotDays(raw);
  const first = days[0];
  if (!first) return null;
  const loc = isObject(raw) && isObject(raw.location) ? raw.location : {};
  const next = first.slots.length ? null : days.slice(1).find(d => d.slots.length);
  return {
    date: first.date,
    timezone: timezone(loc.timezone),
    slots: first.slots,
    nextAvailable: next ? { date: next.date, startAt: next.slots[0].startAt } : null,
  };
});

// ─── Home ─────────────────────────────────────────────
const BANNER_SCREENS = ['video_consultation', 'symptom_checker', 'emergency', 'records', 'available_today'] as const;

/**
 * A home banner `{ id, imageUrl, title, subtitle, targetType, targetScreen,
 * target: { id, slug?, name } | null }`; one that can't be opened is dropped.
 */
export const healthBannerSerializer = (raw: unknown): HealthBanner | null => {
  if (!isObject(raw) || !str(raw.id) || !str(raw.imageUrl) || !str(raw.title)) return null;
  const t = isObject(raw.target) ? raw.target : {};
  const type = str(raw.targetType, 'none');
  let target: HealthBannerTarget | null = null;
  if (type === 'specialty' || type === 'condition') target = str(t.slug) ? { kind: type, slug: str(t.slug), name: str(t.name) } : null;
  else if (type === 'doctor') target = str(t.id) ? { kind: 'doctor', id: str(t.id), name: str(t.name, 'Doctor') } : null;
  else if (type === 'screen') {
    const screen = oneOf(raw.targetScreen, BANNER_SCREENS, null);
    target = screen ? { kind: 'screen', screen } : null;
  } else if (type === 'none') target = { kind: 'none' };
  if (!target) return null;
  return { id: str(raw.id), imageUrl: str(raw.imageUrl), headline: str(raw.title), subhead: strOrNull(raw.subtitle), target };
};

export const healthHomeSerializer = fromResponse((raw: unknown): HealthHome | null => {
  if (!isObject(raw)) return null;
  const upcoming = raw.upcomingAppointment ?? raw.upcoming;
  return {
    city: str(raw.city, 'Lahore'),
    cities: strings(raw.cities),
    specialties: compact(arr(raw.specialties).map(specialtySerializer)),
    commonConditions: compact(arr(raw.commonConditions).map(conditionSerializer)),
    availableToday: compact(arr(raw.availableTodayNearby ?? raw.availableToday).map(doctorCardSerializer)),
    featuredDoctors: compact(arr(raw.featuredDoctors).map(doctorCardSerializer)),
    featuredScope: oneOf(raw.featuredScope, ['city', 'nationwide'] as const, 'city'),
    banners: compact(arr(raw.banners).map(healthBannerSerializer)),
    upcoming: upcoming ? appointmentSummarySerializer(upcoming) : null,
    emergencyNumbers: emergencyNumbersSerializer(raw.emergencyNumbers),
  };
});

export const suggestionsSerializer = fromResponse((raw: unknown): HealthSuggestions => {
  const r = isObject(raw) ? raw : {};
  return {
    doctors: compact(
      arr(r.doctors).map(d =>
        isObject(d) && str(d.id) ? { id: str(d.id), name: doctorName(d), specialtyName: specialtyRefSerializer(d.specialty).name } : null,
      ),
    ),
    specialties: compact(arr(r.specialties).map(specialtySerializer)),
    conditions: compact(arr(r.conditions).map(conditionSerializer)),
  };
});

export const specialtiesSerializer = fromResponse((raw: unknown): Specialty[] => compact(arr(raw).map(specialtySerializer)));
export const conditionsSerializer = fromResponse((raw: unknown): Condition[] => compact(arr(raw).map(conditionSerializer)));

/** A page of doctorCards, as the API answers it. */
export const doctorCardPageSerializer = fromResponse(raw => paged(raw, doctorCardSerializer));

/** A page of doctorReviews, as the API answers it. */
export const doctorReviewPageSerializer = fromResponse(raw => paged(raw, doctorReviewSerializer));

/** A doctor's profile read with doctors like them. */
export const doctorWithSimilarSerializer = (parts: { profile: unknown; similar: unknown }) => {
  const { profile, similar } = bodiesOf(parts);
  return doctorProfileSerializer(isObject(profile) ? { ...profile, similar } : null);
};
