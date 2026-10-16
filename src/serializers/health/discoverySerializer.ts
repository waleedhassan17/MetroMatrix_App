// MetroMatrix — Health discovery serializers: specialties, conditions,
// doctors, profiles, availability and reviews.
// TODO(API_HEALTH): shapes from docs/API_HEALTH_ASSUMED.md.

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
import { arr, bool, enumList, isObject, num, oneOf, str, strOrNull } from '../serializerUtils';
import { compact, count, iso, isoOrNull, money } from '../shopping/common';
import {
  KINDS,
  availabilitySerializer,
  dayOrNull,
  emergencyNumbersSerializer,
  gender,
  numOrNull,
  rating,
  specialtyRefSerializer,
  strings,
  timezone,
} from './healthCommon';
import { appointmentSummarySerializer } from './appointmentSerializer';

const BADGES: readonly DoctorBadge[] = ['pmdc_verified', 'top_booked'];
const PERIODS: readonly SlotPeriod[] = ['morning', 'afternoon', 'evening', 'night'];
const DIMENSIONS: readonly ReviewDimension[] = ['diagnosis', 'staff', 'environment'];

export const specialtySerializer = (raw: unknown): Specialty | null => {
  if (!isObject(raw)) return null;
  const slug = str(raw.slug);
  if (!slug) return null;
  return {
    id: str(raw.id, slug),
    slug,
    name: str(raw.name, slug),
    nameUr: str(raw.nameUr),
    icon: str(raw.icon, 'medkit-outline'),
    doctorCount: count(raw.doctorCount),
  };
};

export const conditionSerializer = (raw: unknown): Condition | null => {
  if (!isObject(raw)) return null;
  const slug = str(raw.slug);
  if (!slug) return null;
  return {
    id: str(raw.id, slug),
    slug,
    name: str(raw.name, slug),
    nameUr: strOrNull(raw.nameUr),
    specialtySlug: strOrNull(raw.specialtySlug),
    isCommon: bool(raw.isCommon),
    // TODO(API_HEALTH): conditions carry no icon yet; proposed as the condition `icon` key.
    icon: strOrNull(raw.icon),
  };
};

export const doctorCardSerializer = (raw: unknown): DoctorCardData | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  return {
    id,
    name: str(raw.name, 'Doctor'),
    photoUrl: strOrNull(raw.photoUrl),
    gender: gender(raw.gender),
    specialty: specialtyRefSerializer(raw.specialty),
    qualifications: str(raw.qualifications),
    yearsExperience: count(raw.yearsExperience),
    rating: rating(raw.rating),
    reviewCount: count(raw.reviewCount),
    waitMinutes: numOrNull(raw.waitMinutes),
    badges: enumList(raw.badges, BADGES),
    offersVideo: bool(raw.offersVideo),
    offersClinic: bool(raw.offersClinic),
    fromFee: money(raw.fromFee),
    availability: availabilitySerializer(raw.availability),
    city: str(raw.city),
  };
};

const timingSerializer = (raw: unknown): TimingRow | null =>
  isObject(raw) && str(raw.days) ? { days: str(raw.days), hours: str(raw.hours) } : null;

export const locationSerializer = (raw: unknown): PracticeLocation | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const kind = oneOf(raw.kind, KINDS, 'clinic');
  return {
    id,
    kind,
    name: str(raw.name, kind === 'video' ? 'Video consultation' : 'Clinic'),
    area: str(raw.area),
    city: str(raw.city),
    address: strOrNull(raw.address),
    lat: numOrNull(raw.lat),
    lng: numOrNull(raw.lng),
    phone: strOrNull(raw.phone),
    fee: money(raw.fee),
    slotMinutes: Math.max(5, count(raw.slotMinutes) || 15),
    instructions: strOrNull(raw.instructions),
    timezone: timezone(raw.timezone),
    availability: availabilitySerializer(raw.availability),
    timings: compact(arr(raw.timings).map(timingSerializer)),
    requiresPrepay: kind === 'video' && bool(raw.requiresPrepay),
  };
};

const qualificationSerializer = (raw: unknown): Qualification | null =>
  isObject(raw) && str(raw.degree) ? { degree: str(raw.degree), institute: str(raw.institute), year: numOrNull(raw.year) } : null;

const experienceSerializer = (raw: unknown): ExperienceRow | null =>
  isObject(raw) && str(raw.role) ? { role: str(raw.role), place: str(raw.place), from: numOrNull(raw.from), to: numOrNull(raw.to) } : null;

export const reviewSummarySerializer = (raw: unknown): DoctorReviewSummary => {
  const r = isObject(raw) ? raw : {};
  const dist = arr(r.distribution).map(count);
  return {
    average: rating(r.average),
    count: count(r.count),
    recommendPct: numOrNull(r.recommendPct),
    distribution: [0, 1, 2, 3, 4].map(i => dist[i] ?? 0),
    dimensions: compact(
      arr(r.dimensions).map(d => {
        if (!isObject(d)) return null;
        const key = oneOf(d.key, DIMENSIONS, null);
        return key ? { key, label: str(d.label, key), score: rating(d.score) } : null;
      }),
    ),
    tags: compact(arr(r.tags).map(t => (isObject(t) && str(t.label) ? { label: str(t.label), count: count(t.count) } : null))),
  };
};

export const doctorReviewSerializer = (raw: unknown): DoctorReview | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const reply = isObject(raw.reply) && str(raw.reply.text) ? { text: str(raw.reply.text), createdAt: iso(raw.reply.createdAt) } : null;
  return {
    id,
    authorName: str(raw.authorName, 'Verified patient'),
    rating: Math.min(5, Math.max(1, Math.round(num(raw.rating, 5)))),
    kind: oneOf(raw.kind, KINDS, 'clinic'),
    tags: strings(raw.tags),
    text: strOrNull(raw.text),
    recommend: typeof raw.recommend === 'boolean' ? raw.recommend : null,
    createdAt: iso(raw.createdAt),
    reply,
    isHidden: bool(raw.isHidden),
    replyEditableUntil: isoOrNull(raw.replyEditableUntil),
    doctorName: strOrNull(raw.doctorName),
  };
};

const bookingRulesSerializer = (raw: unknown): BookingRules => {
  const r = isObject(raw) ? raw : {};
  return {
    windowDays: count(r.windowDays) || 14,
    minNoticeMinutes: count(r.minNoticeMinutes),
    cancelCutoffHours: count(r.cancelCutoffHours),
    videoPrepay: bool(r.videoPrepay),
  };
};

export const doctorProfileSerializer = (raw: unknown): DoctorProfile | null => {
  const card = doctorCardSerializer(raw);
  if (!card || !isObject(raw)) return null;
  const stats = isObject(raw.stats) ? raw.stats : {};
  const locations = compact(arr(raw.locations).map(locationSerializer));
  return {
    ...card,
    title: str(raw.title, 'Dr.'),
    about: str(raw.about),
    languages: strings(raw.languages),
    services: strings(raw.services),
    conditions: compact(arr(raw.conditions).map(c => (isObject(c) && str(c.slug) ? { slug: str(c.slug), name: str(c.name, str(c.slug)) } : null))),
    qualificationList: compact(arr(raw.qualificationList).map(qualificationSerializer)),
    experienceList: compact(arr(raw.experienceList).map(experienceSerializer)),
    // Video first when offered (the API orders them; this keeps it true).
    locations: [...locations.filter(l => l.kind === 'video'), ...locations.filter(l => l.kind === 'clinic')],
    stats: {
      satisfactionPct: numOrNull(stats.satisfactionPct),
      waitMinutes: numOrNull(stats.waitMinutes),
      timeWithPatientMinutes: numOrNull(stats.timeWithPatientMinutes),
      reviewCount: count(stats.reviewCount ?? card.reviewCount),
    },
    reviewSummary: reviewSummarySerializer(raw.reviewSummary),
    topReviews: compact(arr(raw.topReviews).map(doctorReviewSerializer)),
    similar: compact(arr(raw.similar).map(doctorCardSerializer)),
    bookingRules: bookingRulesSerializer(raw.bookingRules),
  };
};

export const daysSerializer = (raw: unknown): DayAvailability[] =>
  compact(
    arr(isObject(raw) && Array.isArray(raw.items) ? raw.items : raw).map(d => {
      if (!isObject(d)) return null;
      const date = dayOrNull(d.date);
      return date ? { date, slotCount: count(d.slotCount) } : null;
    }),
  );

const slotSerializer = (raw: unknown): Slot | null => {
  if (!isObject(raw)) return null;
  const startAt = isoOrNull(raw.startAt);
  return startAt ? { startAt, period: oneOf(raw.period, PERIODS, 'morning') } : null;
};

export const slotsSerializer = (raw: unknown): Slot[] =>
  compact(arr(raw).map(slotSerializer)).sort((a, b) => a.startAt.localeCompare(b.startAt));

export const slotDaySerializer = (raw: unknown): SlotDay | null => {
  if (!isObject(raw)) return null;
  const date = dayOrNull(raw.date);
  if (!date) return null;
  const next = isObject(raw.nextAvailable) ? raw.nextAvailable : null;
  const nextDate = next ? dayOrNull(next.date) : null;
  const nextStart = next ? isoOrNull(next.startAt) : null;
  return {
    date,
    timezone: timezone(raw.timezone),
    slots: slotsSerializer(raw.slots),
    nextAvailable: nextDate && nextStart ? { date: nextDate, startAt: nextStart } : null,
  };
};

const BANNER_SCREENS = ['video_consultation', 'symptom_checker', 'emergency', 'records', 'available_today'] as const;

/**
 * A Health banner: `{ id, imageUrl, title, subtitle, targetType, targetScreen,
 * target: { id, slug, name } }` (the target resolved by the server). A banner
 * whose target can't be opened is dropped. TODO(API_HEALTH): banners.
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

export const healthHomeSerializer = (raw: unknown): HealthHome | null => {
  if (!isObject(raw)) return null;
  return {
    city: str(raw.city, 'Lahore'),
    cities: strings(raw.cities),
    specialties: compact(arr(raw.specialties).map(specialtySerializer)),
    commonConditions: compact(arr(raw.commonConditions).map(conditionSerializer)),
    availableToday: compact(arr(raw.availableToday).map(doctorCardSerializer)),
    featuredDoctors: compact(arr(raw.featuredDoctors).map(doctorCardSerializer)),
    banners: compact(arr(raw.banners).map(healthBannerSerializer)),
    upcoming: raw.upcoming ? appointmentSummarySerializer(raw.upcoming) : null,
    emergencyNumbers: emergencyNumbersSerializer(raw.emergencyNumbers),
  };
};

export const suggestionsSerializer = (raw: unknown): HealthSuggestions => {
  const r = isObject(raw) ? raw : {};
  return {
    doctors: compact(
      arr(r.doctors).map(d => (isObject(d) && str(d.id) ? { id: str(d.id), name: str(d.name, 'Doctor'), specialtyName: str(d.specialtyName) } : null)),
    ),
    specialties: compact(arr(r.specialties).map(specialtySerializer)),
    conditions: compact(arr(r.conditions).map(conditionSerializer)),
  };
};

export const specialtiesSerializer = (raw: unknown): Specialty[] => compact(arr(raw).map(specialtySerializer));
export const conditionsSerializer = (raw: unknown): Condition[] => compact(arr(raw).map(conditionSerializer));
