// MetroMatrix — The doctor's public profile and booking rules.

import type { BookingRules, Completeness, CompletenessKey, DoctorOwnProfile, ExperienceRow, Qualification } from '../../types/health';
import type { ValidationErrors } from '../authModel';

export const TITLES = ['Dr.', 'Prof. Dr.', 'Assoc. Prof. Dr.', 'Asst. Prof. Dr.'];
export const LANGUAGES = ['Urdu', 'English', 'Punjabi', 'Sindhi', 'Pashto', 'Saraiki', 'Balochi'];
export const MAX_ABOUT = 1200;
export const MAX_SERVICES = 20;

export const BOOKING_WINDOW_CHOICES = [7, 14, 30];
export const MIN_NOTICE_CHOICES = [15, 30, 60, 120, 240];
export const CANCEL_CUTOFF_CHOICES = [1, 2, 4, 12, 24];

export const DEFAULT_BOOKING_RULES: BookingRules = { windowDays: 14, minNoticeMinutes: 60, cancelCutoffHours: 4, videoPrepay: false };

export const emptyQualification = (): Qualification => ({ degree: '', institute: '', year: null });
export const emptyExperience = (): ExperienceRow => ({ role: '', place: '', from: null, to: null });

/** "1 h" / "30 min" for a notice choice. */
export const minutesLabel = (m: number) => (m >= 60 ? `${m / 60} h` : `${m} min`);

export const validateDoctorProfile = (p: DoctorOwnProfile, thisYear: number): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (p.name.trim().length < 3) errors.name = 'Enter your full name';
  if (!p.specialtySlug) errors.specialtySlug = 'Choose your specialty';
  if (p.secondarySpecialtySlug && p.secondarySpecialtySlug === p.specialtySlug) errors.secondarySpecialtySlug = 'Choose a different second specialty';
  if (p.practisingSince !== null && (p.practisingSince < 1950 || p.practisingSince > thisYear)) errors.practisingSince = 'Check the year';
  if (!p.languages.length) errors.languages = 'Choose at least one language';
  if (p.about.length > MAX_ABOUT) errors.about = `Keep it under ${MAX_ABOUT} characters`;
  if (p.services.length > MAX_SERVICES) errors.services = `Up to ${MAX_SERVICES} services`;
  p.qualifications.forEach((q, i) => {
    if (!q.degree.trim()) errors[`qualification.${i}.degree`] = 'Enter the degree or remove this row';
    if (q.year !== null && (q.year < 1950 || q.year > thisYear)) errors[`qualification.${i}.year`] = 'Check the year';
  });
  p.experience.forEach((e, i) => {
    if (!e.role.trim() || !e.place.trim()) errors[`experience.${i}.role`] = 'Enter the role and the place, or remove this row';
    else if (e.from === null) errors[`experience.${i}.from`] = 'Enter the year you started';
    if (e.from !== null && e.to !== null && e.to < e.from) errors[`experience.${i}.to`] = 'The end year is before the start';
  });
  return errors;
};

/** Years in practice, from the year they started. */
export const yearsSince = (since: number | null, thisYear: number) => (since ? Math.max(0, thisYear - since) : 0);

/** The fields a doctor can change, ready to send: blank qualification and experience rows dropped. */
export const ownProfilePatch = (p: DoctorOwnProfile): Partial<DoctorOwnProfile> => ({
  title: p.title,
  name: p.name,
  gender: p.gender,
  photoUrl: p.photoUrl,
  specialtySlug: p.specialtySlug,
  secondarySpecialtySlug: p.secondarySpecialtySlug,
  practisingSince: p.practisingSince,
  languages: p.languages,
  about: p.about,
  qualifications: p.qualifications.filter(q => q.degree.trim()),
  experience: p.experience.filter(e => e.role.trim() && e.place.trim()),
  services: p.services,
  conditionSlugs: p.conditionSlugs,
  bookingRules: p.bookingRules,
});

/**
 * The practice set-up checklist. The API names what's missing (its own
 * keys); each step here covers some of them. "Preview" is ready once there
 * is a location with hours to preview.
 */
const CHECKLIST: { key: CompletenessKey; label: string; covers: string[] }[] = [
  { key: 'photo', label: 'Profile photo', covers: ['photo'] },
  { key: 'about', label: 'About you', covers: ['about', 'name', 'gender', 'primary_specialty', 'practicing_since', 'languages'] },
  { key: 'qualifications', label: 'Qualifications', covers: ['qualifications'] },
  { key: 'services', label: 'Services and conditions', covers: ['services', 'conditions'] },
  { key: 'location', label: 'At least one location', covers: ['active_location'] },
  { key: 'hours', label: 'Weekly hours', covers: ['weekly_schedule'] },
  { key: 'preview', label: 'Preview what patients see', covers: ['active_location', 'weekly_schedule'] },
];

/** `{ percent, missing, isListed }` from the API → the app's checklist (the server's percent decides publishing). */
export const completenessFrom = (missing: string[], percent: number, isListed: boolean): Completeness => {
  const items = CHECKLIST.map(c => ({ key: c.key, label: c.label, done: !c.covers.some(k => missing.includes(k)) }));
  const pct = Math.min(100, Math.max(0, Math.round(percent)));
  return { items, percent: pct, isListed, canPublish: pct === 100 && !isListed };
};
