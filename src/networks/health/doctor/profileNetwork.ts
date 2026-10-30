// MetroMatrix — The doctor's own profile, its completeness and publishing.
// MetroMatrix-API docs/API_HEALTH.md §4.3. The API takes specialty and
// condition ids; the app works in slugs (referenceIndex).

import { api, toApiError, unwrap, ApiError } from '../../network/apiHelpers';
import { completenessSerializer, ownProfileSerializer } from '../../../serializers/health/doctorSerializer';
import { titleKey } from '../../../serializers/health/healthCommon';
import { businessSerializer } from '../../../serializers/businessSerializer';
import { arr, isObject, str } from '../../../serializers/serializerUtils';
import type { DoctorOwnProfile } from '../../../types/health';
import { request } from '../../shopping/http';
import { conditionIds, referenceIndex, specialtyIds } from '../referenceIndex';

/** The profile as the app reads it: its second specialty named by slug. */
const readProfile = async (raw: unknown): Promise<DoctorOwnProfile> => {
  const { specialtySlug } = await referenceIndex();
  const second = isObject(raw) ? str(arr(raw.secondarySpecialtyIds)[0]) : '';
  const profile = ownProfileSerializer(isObject(raw) ? { ...raw, secondarySpecialtySlug: specialtySlug.get(second) ?? null } : null);
  if (!profile) throw new ApiError('The server sent something unexpected. Try again.', 'BAD_RESPONSE');
  return profile;
};

export const getOwnProfile = async () => {
  try {
    return await readProfile(unwrap(await api.get('/health/doctor/profile')));
  } catch (e) {
    throw toApiError(e);
  }
};

/** The fields the form changed, as the API names them (lists replace what's stored). */
const profileBody = async (p: Partial<DoctorOwnProfile>) => {
  const out: Record<string, unknown> = {};
  if (p.title !== undefined) out.title = titleKey(p.title);
  if (p.name !== undefined) out.fullName = p.name;
  if (p.gender !== undefined) out.gender = p.gender;
  if (p.photoUrl !== undefined) out.photoUrl = p.photoUrl;
  if (p.specialtySlug !== undefined) out.primarySpecialtyId = (await specialtyIds([p.specialtySlug]))[0];
  if (p.secondarySpecialtySlug !== undefined) out.secondarySpecialtyIds = await specialtyIds([p.secondarySpecialtySlug]);
  if (p.practisingSince !== undefined) out.practicingSince = p.practisingSince ?? undefined;
  if (p.languages !== undefined) out.languages = p.languages;
  if (p.about !== undefined) out.about = p.about;
  if (p.qualifications !== undefined) out.qualifications = p.qualifications.map(q => ({ degree: q.degree, institute: q.institute, year: q.year ?? undefined }));
  if (p.experience !== undefined)
    out.experiences = p.experience.map(e => ({ designation: e.role, institute: e.place, fromYear: e.from ?? undefined, toYear: e.to ?? undefined }));
  if (p.services !== undefined) out.services = p.services;
  if (p.conditionSlugs !== undefined) out.conditionIds = await conditionIds(p.conditionSlugs);
  if (p.bookingRules !== undefined) {
    out.bookingWindowDays = p.bookingRules.windowDays;
    out.minNoticeMinutes = p.bookingRules.minNoticeMinutes;
    out.cancelCutoffMinutes = Math.round(p.bookingRules.cancelCutoffHours * 60);
    out.videoPrepayRequired = p.bookingRules.videoPrepay;
  }
  return out;
};

export const updateOwnProfile = async (patch: Partial<DoctorOwnProfile>) => {
  try {
    return await readProfile(unwrap(await api.patch('/health/doctor/profile', await profileBody(patch))));
  } catch (e) {
    throw toApiError(e);
  }
};

export const getCompleteness = () => request(() => api.get('/health/doctor/profile/completeness'), completenessSerializer);

/** Lists the doctor for patients (`422 PROFILE_INCOMPLETE` until the checklist is done). Answers with the business, now listed. */
export const publishProfile = () =>
  request(async () => {
    await api.post('/health/doctor/listing/publish', {});
    return api.get('/businesses/me');
  }, businessSerializer);
