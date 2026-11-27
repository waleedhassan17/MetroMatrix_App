// MetroMatrix — The doctor's public profile and booking rules.

import type { BookingRules, Completeness, CompletenessKey, DoctorOwnProfile, ExperienceRow, Qualification } from '../health';
import type { ValidationErrors } from '../authModel';

export const TITLES = ['Dr.', 'Prof. Dr.', 'Assoc. Prof. Dr.', 'Asst. Prof. Dr.'];
export const LANGUAGES = ['Urdu', 'English', 'Punjabi', 'Sindhi', 'Pashto', 'Saraiki', 'Balochi', 'Hindko', 'Kashmiri', 'Arabic'];
// The API's own limits (doctors/dto/profile.dto.ts), so it rarely has to refuse anything.
export const MIN_ABOUT = 40;
export const MAX_ABOUT = 1200;
export const MAX_NAME = 120;
export const MAX_SERVICES = 30;
export const MAX_SERVICE = 120;
export const MAX_LANGUAGES = 10;
export const MAX_CONDITIONS = 40;
export const MAX_SECONDARY_SPECIALTIES = 5;
export const MAX_QUALIFICATIONS = 15;
export const MAX_EXPERIENCE = 20;
export const MAX_DEGREE = 80;
export const MAX_INSTITUTE = 160;
export const MAX_ROLE = 120;

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
  const name = p.name.trim();
  if (name.length < 3) errors.name = 'Enter your full name';
  else if (name.length > MAX_NAME) errors.name = `Keep it under ${MAX_NAME} characters`;
  if (!p.specialtySlug) errors.specialtySlug = 'Choose your specialty';
  if (p.secondarySpecialtySlugs.includes(p.specialtySlug ?? '')) errors.secondarySpecialtySlugs = 'Your main specialty is already chosen';
  else if (p.secondarySpecialtySlugs.length > MAX_SECONDARY_SPECIALTIES) errors.secondarySpecialtySlugs = `Up to ${MAX_SECONDARY_SPECIALTIES} more specialties`;
  if (p.practisingSince !== null && (p.practisingSince < 1950 || p.practisingSince > thisYear)) errors.practisingSince = 'Check the year';
  if (!p.languages.length) errors.languages = 'Choose at least one language';
  else if (p.languages.length > MAX_LANGUAGES) errors.languages = `Up to ${MAX_LANGUAGES} languages`;
  // Under 40 characters the API takes you off the patient listing.
  const about = p.about.trim();
  if (about.length < MIN_ABOUT) errors.about = `Write at least ${MIN_ABOUT} characters (${about.length} so far) so patients can find you`;
  else if (p.about.length > MAX_ABOUT) errors.about = `Keep it under ${MAX_ABOUT} characters`;
  if (p.services.length > MAX_SERVICES) errors.services = `Up to ${MAX_SERVICES} services`;
  else if (p.services.some(sv => sv.trim().length < 2 || sv.length > MAX_SERVICE)) errors.services = `Each service needs 2 to ${MAX_SERVICE} characters`;
  if (p.conditionSlugs.length > MAX_CONDITIONS) errors.conditions = `Up to ${MAX_CONDITIONS} conditions`;
  p.qualifications.forEach((q, i) => {
    const degree = q.degree.trim();
    const institute = q.institute.trim();
    if (degree.length < 2) errors[`qualification.${i}.degree`] = 'Enter the degree or remove this row';
    else if (degree.length > MAX_DEGREE) errors[`qualification.${i}.degree`] = `Keep it under ${MAX_DEGREE} characters`;
    if (institute.length < 2) errors[`qualification.${i}.institute`] = 'Enter where you studied';
    else if (institute.length > MAX_INSTITUTE) errors[`qualification.${i}.institute`] = `Keep it under ${MAX_INSTITUTE} characters`;
    if (q.year !== null && (q.year < 1950 || q.year > thisYear)) errors[`qualification.${i}.year`] = 'Check the year';
  });
  p.experience.forEach((e, i) => {
    if (e.role.trim().length < 2 || e.place.trim().length < 2) errors[`experience.${i}.role`] = 'Enter the role and the place, or remove this row';
    else if (e.role.length > MAX_ROLE || e.place.length > MAX_INSTITUTE) errors[`experience.${i}.role`] = 'Shorten the role or the place';
    else if (e.from === null) errors[`experience.${i}.from`] = 'Enter the year you started';
    if (e.from !== null && (e.from < 1950 || e.from > thisYear)) errors[`experience.${i}.from`] = 'Check the year';
    if (e.from !== null && e.to !== null && e.to < e.from) errors[`experience.${i}.to`] = 'The end year is before the start';
  });
  return errors;
};

/** Years in practice, from the year they started. */
export const yearsSince = (since: number | null, thisYear: number) => (since ? Math.max(0, thisYear - since) : 0);

/** The fields a doctor can change, ready to send: blank qualification and experience rows dropped. */
/**
 * What the form sends. The booking rules go only when they changed: the
 * server re-checks them on every write (video prepay needs a payment
 * account), so an unchanged rule must never block saving a new photo or bio.
 */
export const ownProfilePatch = (p: DoctorOwnProfile, saved?: DoctorOwnProfile | null): Partial<DoctorOwnProfile> => ({
  title: p.title,
  name: p.name,
  gender: p.gender,
  photoUrl: p.photoUrl,
  specialtySlug: p.specialtySlug,
  secondarySpecialtySlugs: p.secondarySpecialtySlugs,
  practisingSince: p.practisingSince,
  languages: p.languages,
  about: p.about,
  qualifications: p.qualifications.filter(q => q.degree.trim()),
  experience: p.experience.filter(e => e.role.trim() && e.place.trim()),
  services: p.services,
  conditionSlugs: p.conditionSlugs,
  ...(saved && JSON.stringify(saved.bookingRules) === JSON.stringify(p.bookingRules) ? {} : { bookingRules: p.bookingRules }),
});

/**
 * The practice set-up checklist. The API names what's missing with its own
 * keys (doctors.service `completeness`): pmdc_verified, full_name, gender,
 * photo, primary_specialty, practicing_since, about, languages,
 * qualifications, active_location, weekly_schedule. Each step covers some of
 * them and says which are still missing. "Preview" is ready once there is a
 * location with hours to preview. (Services and conditions were a step the
 * server never checks, so it was always ticked: the 2026-11-26 QA.)
 */
const CHECKLIST: { key: CompletenessKey; label: string; covers: string[] }[] = [
  { key: 'pmdc', label: 'PMDC registration checked', covers: ['pmdc_verified'] },
  { key: 'photo', label: 'Profile photo', covers: ['photo'] },
  { key: 'about', label: 'About you', covers: ['full_name', 'gender', 'primary_specialty', 'practicing_since', 'languages', 'about'] },
  { key: 'qualifications', label: 'Qualifications', covers: ['qualifications'] },
  { key: 'location', label: 'At least one location', covers: ['active_location'] },
  { key: 'hours', label: 'Weekly hours', covers: ['weekly_schedule'] },
  { key: 'preview', label: 'Preview what patients see', covers: ['active_location', 'weekly_schedule'] },
];

/** The server's keys in the words of the "About you" step. */
const MISSING_WORDS: Record<string, string> = {
  full_name: 'your full name',
  gender: 'gender',
  primary_specialty: 'specialty',
  practicing_since: 'practising since',
  languages: 'languages',
  about: `an about of at least ${MIN_ABOUT} characters`,
};

/** `{ percent, missing, isListed }` from the API → the app's checklist (the server's percent decides publishing). */
export const completenessFrom = (missing: string[], percent: number, isListed: boolean): Completeness => {
  const items = CHECKLIST.map(c => {
    const open = c.covers.filter(k => missing.includes(k));
    const words = open.map(k => MISSING_WORDS[k]).filter(Boolean);
    return { key: c.key, label: c.label, done: open.length === 0, detail: c.key === 'about' && words.length ? `Add ${words.join(', ')}` : null };
  });
  const pct = Math.min(100, Math.max(0, Math.round(percent)));
  return { items, percent: pct, isListed, canPublish: pct === 100 && !isListed };
};
