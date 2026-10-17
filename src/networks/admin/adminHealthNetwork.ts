// MetroMatrix — Admin Health console.
// MetroMatrix-API docs/API_HEALTH.md §4.4. Nothing in the taxonomy is ever
// deleted: "delete" deactivates. A condition's specialty is its own route.

import { api, unwrap } from '../network/apiHelpers';
import {
  adminAppointmentSerializer,
  adminConditionSerializer,
  adminDoctorSerializer,
  adminSpecialtySerializer,
  healthOverviewSerializer,
} from '../../serializers/health/adminHealthSerializer';
import { doctorReviewSerializer } from '../../serializers/health/discoverySerializer';
import { iconKeyForGlyph } from '../../serializers/health/healthCommon';
import { compact, paged } from '../../serializers/shopping/common';
import { arr, isObject, str } from '../../serializers/serializerUtils';
import type { AdminConditionInput, AdminSpecialtyInput } from '../../types/health';
import { ack, clean, pageParams, request } from '../shopping/http';
import { resetReferenceIndex, specialtyIds } from '../health/referenceIndex';

const A = '/admin/health';
const enc = encodeURIComponent;

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';

/** Staff edits change what slugs mean: the cached index is dropped. */
const fresh = <T>(p: Promise<T>) => p.finally(resetReferenceIndex);

export const getHealthOverview = () => request(() => api.get(`${A}/overview`), healthOverviewSerializer);

export const listAdminSpecialties = () => request(() => api.get(`${A}/specialties`), raw => compact(arr(raw).map(adminSpecialtySerializer)));

/** The API also wants an Urdu name and keywords; the app is in English, so its name stands in and keywords start empty. */
export const createSpecialty = (input: AdminSpecialtyInput) =>
  fresh(
    request(
      () =>
        api.post(`${A}/specialties`, {
          name: input.name,
          nameUr: input.name,
          slug: slugify(input.name),
          icon: iconKeyForGlyph(input.icon),
          keywords: [],
          sort: input.sort,
        }),
      adminSpecialtySerializer,
    ),
  );

export const updateSpecialty = (id: string, input: Partial<AdminSpecialtyInput>) =>
  fresh(
    request(
      () => api.patch(`${A}/specialties/${enc(id)}`, clean({ name: input.name, icon: input.icon ? iconKeyForGlyph(input.icon) : null, sort: input.sort })),
      adminSpecialtySerializer,
    ),
  );

export const deleteSpecialty = (id: string) => fresh(request(() => api.patch(`${A}/specialties/${enc(id)}`, { isActive: false }), ack));

export const listAdminConditions = (q: string) =>
  request(() => api.get(`${A}/conditions`, { params: clean({ q, pageSize: 100 }) }), raw =>
    compact(arr(isObject(raw) ? raw.items : raw).map(adminConditionSerializer)),
  );

/** First choice (rank 1) — the app keeps one specialty per condition. */
const mapSpecialty = async (id: string, slug: string | null) => {
  const ids = await specialtyIds([slug]);
  return api.put(`${A}/conditions/${enc(id)}/specialties`, ids.map(specialtyId => ({ specialtyId, rank: 1 })));
};

export const createCondition = (input: AdminConditionInput) =>
  fresh(
    request(async () => {
      const created = unwrap(
        await api.post(`${A}/conditions`, { name: input.name, slug: slugify(input.name), aliases: input.aliases, isCommon: input.isCommon }),
      );
      return mapSpecialty(isObject(created) ? str(created.id) : '', input.specialtySlug);
    }, adminConditionSerializer),
  );

export const updateCondition = (id: string, input: Partial<AdminConditionInput>) =>
  fresh(
    request(async () => {
      const res = await api.patch(`${A}/conditions/${enc(id)}`, clean({ name: input.name, aliases: input.aliases, isCommon: input.isCommon }));
      return input.specialtySlug !== undefined ? mapSpecialty(id, input.specialtySlug) : res;
    }, adminConditionSerializer),
  );

export const deleteCondition = (id: string) => fresh(request(() => api.patch(`${A}/conditions/${enc(id)}`, { isActive: false }), ack));

/** `pending`: PMDC numbers still to check. */
export const listDoctorsForVerification = (status: 'pending' | 'all') =>
  request(() => api.get(`${A}/doctors`, { params: clean({ pmdc: status === 'pending' ? 'unverified' : null, pageSize: 100 }) }), raw =>
    compact(arr(isObject(raw) ? raw.items : raw).map(adminDoctorSerializer)),
  );

/** The app keys doctors by business; the route takes the doctor's id, looked up first. */
export const verifyPmdc = (businessId: string, note: string) =>
  request(async () => {
    const page = unwrap(await api.get(`${A}/doctors`, { params: { businessId } }));
    const doctor = arr(isObject(page) ? page.items : []).find(isObject);
    await api.post(`${A}/doctors/${enc(str(doctor?.id))}/pmdc-verify`, clean({ note }));
    return api.get(`${A}/doctors`, { params: { businessId } });
  }, raw => adminDoctorSerializer(arr(isObject(raw) ? raw.items : []).find(isObject)));

export const listReviewsForModeration = (hidden: boolean, page: number, pageSize = 20) =>
  request(() => api.get(`${A}/reviews`, { params: { hidden: hidden ? 'true' : 'false', ...pageParams(page, pageSize) } }), raw =>
    paged(raw, doctorReviewSerializer),
  );

export const setReviewHidden = (id: string, hidden: boolean, reason: string | null) =>
  request(() => api.post(`${A}/reviews/${enc(id)}/${hidden ? 'hide' : 'unhide'}`, hidden ? { reason } : {}), doctorReviewSerializer);

export const lookupAppointment = (code: string) =>
  request(() => api.get(`${A}/appointments/${enc(code.trim().toUpperCase())}`), adminAppointmentSerializer);
