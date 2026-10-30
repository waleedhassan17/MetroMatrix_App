// MetroMatrix — Health discovery: home, specialties, conditions, search, doctors.
// MetroMatrix-API docs/API_HEALTH.md §4.1 (public; signed in, the home adds the next appointment).

import { api } from '../network/apiHelpers';
import { conditionsSerializer, doctorCardSerializer, doctorProfileSerializer, healthHomeSerializer, specialtiesSerializer, suggestionsSerializer, doctorCardPageSerializer } from '../../serializers/health/discoverySerializer';
import { paged } from '../../serializers/shopping/common';
import { isObject } from '../../serializers/serializerUtils';
import { toParams } from '../../models/health/filterModel';
import type { DoctorQuery } from '../../types/health';
import { clean, pageParams, request, requestAll } from '../shopping/http';

const enc = encodeURIComponent;

export const getHealthHome = (city: string | null) =>
  request(() => api.get('/health/home', { params: clean({ city }) }), healthHomeSerializer);

export const listSpecialties = (city: string | null) =>
  request(() => api.get('/health/specialties', { params: clean({ city }) }), specialtiesSerializer);

export const listConditions = (q?: string) =>
  request(() => api.get('/health/conditions', { params: clean({ q }) }), conditionsSerializer);

export const suggest = (q: string) => request(() => api.get('/health/search/suggest', { params: { q } }), suggestionsSerializer);

export const listDoctors = (query: DoctorQuery, page: number, pageSize = 20) =>
  request(
    () => api.get('/health/doctors', { params: clean({ ...toParams(query), ...pageParams(page, pageSize) }) }),
    doctorCardPageSerializer,
  );

/** The profile and the doctors like them, together. */
export const getDoctor = (id: string) =>
  requestAll(
    { profile: () => api.get(`/health/doctors/${enc(id)}`), similar: () => api.get(`/health/doctors/${enc(id)}/similar`) },
    ({ profile, similar }) => doctorProfileSerializer(isObject(profile) ? { ...profile, similar } : null),
  );
