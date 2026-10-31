// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Health Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// MetroMatrix-API docs/API_HEALTH.md §4.4. Nothing in the taxonomy is ever
// deleted: "delete" deactivates. A condition's specialty is its own route.

import { API, toApiError, clean, pageParams } from '../network/network';
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

export const fetchHealthOverview = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${A}/overview` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchAdminSpecialties = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${A}/specialties` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The API also wants an Urdu name and keywords; the app is in English, so its name stands in and keywords start empty. */
/** Staff edits change what slugs mean: callers drop the cached index (resetReferenceIndex). */
export const createSpecialty = async (input: AdminSpecialtyInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${A}/specialties`, data: {
      name: input.name,
      nameUr: input.name,
      slug: slugify(input.name),
      icon: iconKeyForGlyph(input.icon),
      keywords: [],
      sort: input.sort,
    } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateSpecialty = async (id: string, input: Partial<AdminSpecialtyInput>): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${A}/specialties/${enc(id)}`, data: clean({ name: input.name, icon: input.icon ? iconKeyForGlyph(input.icon) : null, sort: input.sort }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteSpecialty = async (id: string): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${A}/specialties/${enc(id)}`, data: { isActive: false } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchAdminConditions = async (q: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${A}/conditions`, params: clean({ q, pageSize: 100 }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createCondition = async (input: AdminConditionInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${A}/conditions`, data: { name: input.name, slug: slugify(input.name), aliases: input.aliases, isCommon: input.isCommon } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateCondition = async (id: string, input: Partial<AdminConditionInput>): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${A}/conditions/${enc(id)}`, data: clean({ name: input.name, aliases: input.aliases, isCommon: input.isCommon }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** First choice (rank 1): the app keeps one specialty per condition. */
export const setConditionSpecialties = async (id: string, specialtyIds: string[]): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: `${A}/conditions/${enc(id)}/specialties`, data: specialtyIds.map(specialtyId => ({ specialtyId, rank: 1 })) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteCondition = async (id: string): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `${A}/conditions/${enc(id)}`, data: { isActive: false } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** `pending`: PMDC numbers still to check. */
export const fetchDoctorsForVerification = async (status: 'pending' | 'all'): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${A}/doctors`, params: clean({ pmdc: status === 'pending' ? 'unverified' : null, pageSize: 100 }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The app keys doctors by business; the route takes the doctor's id, looked up first. */
/** The doctor behind a business (a one-row page). */
export const fetchAdminDoctorByBusiness = async (businessId: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${A}/doctors`, params: { businessId } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const verifyPmdc = async (doctorId: string, note: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${A}/doctors/${enc(doctorId)}/pmdc-verify`, data: clean({ note }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchReviewsForModeration = async (hidden: boolean, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${A}/reviews`, params: { hidden: hidden ? 'true' : 'false', ...pageParams(page, pageSize) } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const setReviewHidden = async (id: string, hidden: boolean, reason: string | null): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${A}/reviews/${enc(id)}/${hidden ? 'hide' : 'unhide'}`, data: hidden ? { reason } : {} });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const lookupAppointment = async (code: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${A}/appointments/${enc(code.trim().toUpperCase())}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
