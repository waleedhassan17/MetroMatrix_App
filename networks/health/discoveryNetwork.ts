// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Discovery Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// Home, specialties, conditions, search, doctors.
// MetroMatrix-API docs/API_HEALTH.md §4.1 (public; signed in, the home adds the next appointment).

import { api, toApiError, clean, pageParams } from '../network/apiHelpers';
import { toParams } from '../../models/health/filterModel';
import type { DoctorQuery } from '../../models/health';

const enc = encodeURIComponent;

export const getHealthHomeAPI = async (city: string | null): Promise<unknown> => {
  try {
    const response = await api.get('/health/home', { params: clean({ city }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getSpecialtiesAPI = async (city: string | null): Promise<unknown> => {
  try {
    const response = await api.get('/health/specialties', { params: clean({ city }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getConditionsAPI = async (q?: string): Promise<unknown> => {
  try {
    const response = await api.get('/health/conditions', { params: clean({ q }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const suggestAPI = async (q: string): Promise<unknown> => {
  try {
    const response = await api.get('/health/search/suggest', { params: { q } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getDoctorsAPI = async (query: DoctorQuery, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await api.get('/health/doctors', { params: clean({ ...toParams(query), ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The profile and the doctors like them, together. */
export const getDoctorAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`/health/doctors/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Doctors like this one (the profile reads them together). */
export const getSimilarDoctorsAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`/health/doctors/${enc(id)}/similar`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
