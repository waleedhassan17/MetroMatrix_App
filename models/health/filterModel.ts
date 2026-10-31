// ═══════════════════════════════════════════════════════
// MetroMatrix — Doctor search filters (DoctorList)
// ═══════════════════════════════════════════════════════
// Quick chips and the Sort & filter sheet edit one DoctorQuery; the server
// filters and sorts (the list never filters on the device).

import type { DoctorQuery, DoctorSort } from '../health';

export const SORTS: { key: DoctorSort; label: string }[] = [
  { key: 'recommended', label: 'Recommended' },
  { key: 'earliest', label: 'Earliest available' },
  { key: 'fee_low', label: 'Lowest fee' },
  { key: 'most_reviewed', label: 'Most reviewed' },
  { key: 'most_experienced', label: 'Most experienced' },
];

export const FEE_CAPS = [1000, 1500, 2000, 3000, 5000];
export const EXPERIENCE_FLOORS = [5, 10, 15, 20];
export const RATING_FLOORS = [4, 4.5];
export const FILTER_LANGUAGES = ['Urdu', 'English', 'Punjabi', 'Sindhi', 'Pashto'];

export type QuickFilter = 'availableToday' | 'video' | 'female' | 'underFee' | 'experienced';

export const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: 'availableToday', label: 'Available today' },
  { key: 'video', label: 'Video consult' },
  { key: 'female', label: 'Female doctor' },
  { key: 'underFee', label: 'Under Rs 1,500' },
  { key: 'experienced', label: '10+ years' },
];

export const baseQuery = (city: string, over: Partial<DoctorQuery> = {}): DoctorQuery => ({
  specialty: null,
  condition: null,
  q: null,
  city,
  kind: null,
  availableToday: false,
  gender: null,
  maxFee: null,
  minYears: null,
  minRating: null,
  language: null,
  area: null,
  sort: 'recommended',
  ...over,
});

export const isQuickOn = (q: DoctorQuery, key: QuickFilter): boolean => {
  switch (key) {
    case 'availableToday':
      return !!q.availableToday;
    case 'video':
      return q.kind === 'video';
    case 'female':
      return q.gender === 'female';
    case 'underFee':
      return q.maxFee === 1500;
    case 'experienced':
      return q.minYears === 10;
  }
};

export const toggleQuick = (q: DoctorQuery, key: QuickFilter): DoctorQuery => {
  const on = isQuickOn(q, key);
  switch (key) {
    case 'availableToday':
      return { ...q, availableToday: !on };
    case 'video':
      return { ...q, kind: on ? null : 'video' };
    case 'female':
      return { ...q, gender: on ? null : 'female' };
    case 'underFee':
      return { ...q, maxFee: on ? null : 1500 };
    case 'experienced':
      return { ...q, minYears: on ? null : 10 };
  }
};

/** How many sheet filters are set (the "Sort & filter" badge). Context (specialty, condition, city) isn't counted. */
export const activeFilterCount = (q: DoctorQuery): number =>
  [q.kind, q.availableToday || null, q.gender, q.maxFee, q.minYears, q.minRating, q.language, q.area, q.sort !== 'recommended' ? q.sort : null].filter(
    v => v !== null && v !== undefined,
  ).length;

/** Clear every filter but keep the context the list was opened with. */
export const clearFilters = (q: DoctorQuery): DoctorQuery =>
  baseQuery(q.city, { specialty: q.specialty, condition: q.condition, q: q.q });

/** The query string the API takes (unset values dropped by the network). */
/** The app's sort names → the API's (`GET /health/doctors?sort=`). */
const SORT_PARAM: Record<DoctorSort, string> = {
  recommended: 'recommended',
  earliest: 'earliest',
  fee_low: 'fee_asc',
  most_reviewed: 'reviews',
  most_experienced: 'experience',
};

/** The query string for `GET /health/doctors` (MetroMatrix-API docs/API_HEALTH.md §4.1). */
export const toParams = (q: DoctorQuery) => ({
  specialty: q.specialty,
  condition: q.condition,
  q: q.q,
  city: q.city,
  kind: q.kind,
  availableToday: q.availableToday ? 'true' : undefined,
  gender: q.gender,
  maxFee: q.maxFee,
  minExperience: q.minYears,
  minRating: q.minRating,
  language: q.language,
  area: q.area,
  sort: SORT_PARAM[q.sort] ?? 'recommended',
});

/** A stable key for usePagedList: a new key restarts the list. */
export const queryKey = (q: DoctorQuery) => JSON.stringify(toParams(q));
