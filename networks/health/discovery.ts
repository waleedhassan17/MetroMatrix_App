// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Discovery Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// Home, specialties, conditions, search, doctors.
// MetroMatrix-API docs/API_HEALTH.md §4.1 (public; signed in, the home adds the next appointment).

import { API, toApiError, clean, pageParams } from '../network/network';
import { toParams } from '../../models/health/filterModel';
import type { DoctorQuery } from '../../models/health';

const enc = encodeURIComponent;

export const fetchHealthHome = async (city: string | null): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/health/home', params: clean({ city }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchSpecialties = async (city: string | null): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/health/specialties', params: clean({ city }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchConditions = async (q?: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/health/conditions', params: clean({ q }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const suggest = async (q: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/health/search/suggest', params: { q } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchDoctors = async (query: DoctorQuery, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/health/doctors', params: clean({ ...toParams(query), ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The profile and the doctors like them, together. */
export const fetchDoctor = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/health/doctors/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Doctors like this one (the profile reads them together). */
export const fetchSimilarDoctors = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/health/doctors/${enc(id)}/similar` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
