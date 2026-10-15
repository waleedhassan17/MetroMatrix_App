// MetroMatrix — Health discovery: home, specialties, conditions, search, doctors.
// TODO(API_HEALTH): paths and shapes from docs/API_HEALTH_ASSUMED.md.

import { api } from '../network/apiHelpers';
import {
  conditionsSerializer,
  doctorCardSerializer,
  doctorProfileSerializer,
  healthHomeSerializer,
  specialtiesSerializer,
  suggestionsSerializer,
} from '../../serializers/health/discoverySerializer';
import { paged } from '../../serializers/shopping/common';
import { toParams } from '../../models/health/filterModel';
import type { DoctorQuery } from '../../types/health';
import { clean, pageParams, request } from '../shopping/http';

export const getHealthHome = (city: string | null) =>
  request(() => api.get('/healthcare/home', { params: clean({ city }) }), healthHomeSerializer);

export const listSpecialties = (city: string | null) =>
  request(() => api.get('/healthcare/specialties', { params: clean({ city }) }), specialtiesSerializer);

export const listConditions = (q?: string) =>
  request(() => api.get('/healthcare/conditions', { params: clean({ q }) }), conditionsSerializer);

export const suggest = (q: string) =>
  request(() => api.get('/healthcare/search/suggest', { params: { q } }), suggestionsSerializer);

export const listDoctors = (query: DoctorQuery, page: number, pageSize = 20) =>
  request(
    () => api.get('/healthcare/doctors', { params: clean({ ...toParams(query), ...pageParams(page, pageSize) }) }),
    raw => paged(raw, doctorCardSerializer),
  );

export const getDoctor = (id: string) =>
  request(() => api.get(`/healthcare/doctors/${encodeURIComponent(id)}`), doctorProfileSerializer);
