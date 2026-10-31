// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Health Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// MetroMatrix-API docs/API_HEALTH.md §4.4. Nothing in the taxonomy is ever
// deleted: "delete" deactivates. A condition's specialty is its own route.

import { api, toApiError, clean, pageParams } from '../network/apiHelpers';
import { iconKeyForGlyph } from '../../serializers/health/healthCommon';
import type { AdminConditionInput, AdminSpecialtyInput } from '../../models/health';
import { specialtyIds } from '../health/referenceIndex';

const A = '/admin/health';
const enc = encodeURIComponent;

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';

export const getHealthOverviewAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get(`${A}/overview`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getAdminSpecialtiesAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get(`${A}/specialties`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The API also wants an Urdu name and keywords; the app is in English, so its name stands in and keywords start empty. */
/** Staff edits change what slugs mean: callers drop the cached index (resetReferenceIndex). */
export const createSpecialtyAPI = async (input: AdminSpecialtyInput): Promise<unknown> => {
  try {
    const response = await api.post(`${A}/specialties`, {
      name: input.name,
      nameUr: input.name,
      slug: slugify(input.name),
      icon: iconKeyForGlyph(input.icon),
      keywords: [],
      sort: input.sort,
    });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateSpecialtyAPI = async (id: string, input: Partial<AdminSpecialtyInput>): Promise<unknown> => {
  try {
    const response = await api.patch(`${A}/specialties/${enc(id)}`, clean({ name: input.name, icon: input.icon ? iconKeyForGlyph(input.icon) : null, sort: input.sort }));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteSpecialtyAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.patch(`${A}/specialties/${enc(id)}`, { isActive: false });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getAdminConditionsAPI = async (q: string): Promise<unknown> => {
  try {
    const response = await api.get(`${A}/conditions`, { params: clean({ q, pageSize: 100 }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createConditionAPI = async (input: AdminConditionInput): Promise<unknown> => {
  try {
    const response = await api.post(`${A}/conditions`, { name: input.name, slug: slugify(input.name), aliases: input.aliases, isCommon: input.isCommon });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateConditionAPI = async (id: string, input: Partial<AdminConditionInput>): Promise<unknown> => {
  try {
    const response = await api.patch(`${A}/conditions/${enc(id)}`, clean({ name: input.name, aliases: input.aliases, isCommon: input.isCommon }));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** First choice (rank 1): the app keeps one specialty per condition. */
export const setConditionSpecialtiesAPI = async (id: string, specialtyIds: string[]): Promise<unknown> => {
  try {
    const response = await api.put(`${A}/conditions/${enc(id)}/specialties`, specialtyIds.map(specialtyId => ({ specialtyId, rank: 1 })));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteConditionAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.patch(`${A}/conditions/${enc(id)}`, { isActive: false });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** `pending`: PMDC numbers still to check. */
export const getDoctorsForVerificationAPI = async (status: 'pending' | 'all'): Promise<unknown> => {
  try {
    const response = await api.get(`${A}/doctors`, { params: clean({ pmdc: status === 'pending' ? 'unverified' : null, pageSize: 100 }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The app keys doctors by business; the route takes the doctor's id, looked up first. */
/** The doctor behind a business (a one-row page). */
export const getAdminDoctorByBusinessAPI = async (businessId: string): Promise<unknown> => {
  try {
    const response = await api.get(`${A}/doctors`, { params: { businessId } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const verifyPmdcAPI = async (doctorId: string, note: string): Promise<unknown> => {
  try {
    const response = await api.post(`${A}/doctors/${enc(doctorId)}/pmdc-verify`, clean({ note }));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getReviewsForModerationAPI = async (hidden: boolean, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await api.get(`${A}/reviews`, { params: { hidden: hidden ? 'true' : 'false', ...pageParams(page, pageSize) } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const setReviewHiddenAPI = async (id: string, hidden: boolean, reason: string | null): Promise<unknown> => {
  try {
    const response = await api.post(`${A}/reviews/${enc(id)}/${hidden ? 'hide' : 'unhide'}`, hidden ? { reason } : {});
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const lookupAppointmentAPI = async (code: string): Promise<unknown> => {
  try {
    const response = await api.get(`${A}/appointments/${enc(code.trim().toUpperCase())}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
