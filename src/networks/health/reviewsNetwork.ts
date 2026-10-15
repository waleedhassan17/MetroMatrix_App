// MetroMatrix — Doctor reviews: read them, and rate a completed visit.
// TODO(API_HEALTH): paths and shapes from docs/API_HEALTH_ASSUMED.md.

import { api } from '../network/apiHelpers';
import { doctorReviewSerializer } from '../../serializers/health/discoverySerializer';
import { appointmentDetailSerializer } from '../../serializers/health/appointmentSerializer';
import { paged } from '../../serializers/shopping/common';
import type { ConsultKind, DoctorReviewInput } from '../../types/health';
import { clean, pageParams, request } from '../shopping/http';

export type DoctorReviewSort = 'recent' | 'highest' | 'lowest';

export const listDoctorReviews = (doctorId: string, filter: { kind: ConsultKind | null; sort: DoctorReviewSort }, page: number, pageSize = 20) =>
  request(
    () => api.get(`/healthcare/doctors/${encodeURIComponent(doctorId)}/reviews`, { params: clean({ ...filter, ...pageParams(page, pageSize) }) }),
    raw => paged(raw, doctorReviewSerializer),
  );

/** Answers with the appointment (now `reviewed`). */
export const reviewAppointment = (code: string, input: DoctorReviewInput) =>
  request(() => api.post(`/healthcare/appointments/${encodeURIComponent(code)}/review`, input), appointmentDetailSerializer);
