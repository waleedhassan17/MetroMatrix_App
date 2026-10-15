// MetroMatrix — Admin Health console.
// TODO(API_HEALTH): paths and shapes from docs/API_HEALTH_ASSUMED.md.

import { api } from '../network/apiHelpers';
import {
  adminAppointmentSerializer,
  adminConditionSerializer,
  adminDoctorSerializer,
  adminSpecialtySerializer,
  healthOverviewSerializer,
} from '../../serializers/health/adminHealthSerializer';
import { doctorReviewSerializer } from '../../serializers/health/discoverySerializer';
import { compact, paged } from '../../serializers/shopping/common';
import { arr } from '../../serializers/serializerUtils';
import type { AdminConditionInput, AdminSpecialtyInput } from '../../types/health';
import { ack, clean, pageParams, request } from '../shopping/http';

const A = '/admin/healthcare';

export const getHealthOverview = () => request(() => api.get(`${A}/overview`), healthOverviewSerializer);

export const listAdminSpecialties = () =>
  request(() => api.get(`${A}/specialties`), raw => compact(arr(raw).map(adminSpecialtySerializer)));
export const createSpecialty = (input: AdminSpecialtyInput) => request(() => api.post(`${A}/specialties`, input), adminSpecialtySerializer);
export const updateSpecialty = (id: string, input: Partial<AdminSpecialtyInput>) =>
  request(() => api.patch(`${A}/specialties/${encodeURIComponent(id)}`, input), adminSpecialtySerializer);
export const deleteSpecialty = (id: string) => request(() => api.delete(`${A}/specialties/${encodeURIComponent(id)}`), ack);

export const listAdminConditions = (q: string) =>
  request(() => api.get(`${A}/conditions`, { params: clean({ q }) }), raw => compact(arr(raw).map(adminConditionSerializer)));
export const createCondition = (input: AdminConditionInput) => request(() => api.post(`${A}/conditions`, input), adminConditionSerializer);
export const updateCondition = (id: string, input: Partial<AdminConditionInput>) =>
  request(() => api.patch(`${A}/conditions/${encodeURIComponent(id)}`, input), adminConditionSerializer);
export const deleteCondition = (id: string) => request(() => api.delete(`${A}/conditions/${encodeURIComponent(id)}`), ack);

export const listDoctorsForVerification = (status: 'pending' | 'all') =>
  request(() => api.get(`${A}/doctors`, { params: { status } }), raw => compact(arr(raw).map(adminDoctorSerializer)));
export const verifyPmdc = (businessId: string, note: string) =>
  request(() => api.post(`${A}/doctors/${encodeURIComponent(businessId)}/pmdc-verify`, { note }), adminDoctorSerializer);

export const listReviewsForModeration = (hidden: boolean, page: number, pageSize = 20) =>
  request(() => api.get(`${A}/reviews`, { params: clean({ hidden, ...pageParams(page, pageSize) }) }), raw => paged(raw, doctorReviewSerializer));
export const setReviewHidden = (id: string, hidden: boolean, reason: string | null) =>
  request(() => api.post(`${A}/reviews/${encodeURIComponent(id)}/${hidden ? 'hide' : 'unhide'}`, { reason }), doctorReviewSerializer);

export const lookupAppointment = (code: string) =>
  request(() => api.get(`${A}/appointments/${encodeURIComponent(code.trim().toUpperCase())}`), adminAppointmentSerializer);
