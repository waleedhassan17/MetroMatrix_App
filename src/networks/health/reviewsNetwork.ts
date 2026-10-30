// MetroMatrix — Doctor reviews: read them, and rate a completed visit.
// MetroMatrix-API docs/API_HEALTH.md §2 (Review), §4.1, §4.2.

import { api } from '../network/apiHelpers';
import { doctorReviewSerializer, doctorReviewPageSerializer } from '../../serializers/health/discoverySerializer';
import { appointmentDetailSerializer } from '../../serializers/health/appointmentSerializer';
import { paged } from '../../serializers/shopping/common';
import { reviewTagCodes } from '../../models/health/reviewFormModel';
import type { ConsultKind, DoctorReviewInput } from '../../types/health';
import { clean, pageParams, request } from '../shopping/http';

const enc = encodeURIComponent;

export type DoctorReviewSort = 'recent' | 'highest' | 'lowest';

export const listDoctorReviews = (
  doctorId: string,
  filter: { kind: ConsultKind | null; sort: DoctorReviewSort; rating?: number | null },
  page: number,
  pageSize = 20,
) =>
  request(
    () =>
      api.get(`/health/doctors/${enc(doctorId)}/reviews`, {
        params: clean({
          kind: filter.kind,
          sort: filter.sort === 'recent' ? 'latest' : filter.sort,
          rating: filter.rating,
          ...pageParams(page, pageSize),
        }),
      }),
    doctorReviewPageSerializer,
  );

/**
 * The API asks for a diagnosis score on every review; a patient who only
 * gave stars has it scored the same as their overall rating.
 */
const reviewBody = (r: DoctorReviewInput) => ({
  overall: r.rating,
  diagnosis: r.dimensions.diagnosis ?? r.rating,
  staff: r.dimensions.staff,
  environment: r.dimensions.environment,
  recommend: r.recommend,
  tags: reviewTagCodes(r.tags),
  text: r.text ?? undefined,
  isAnonymous: r.anonymous,
});

/** Answers with the appointment (now `reviewed`). */
export const reviewAppointment = (code: string, input: DoctorReviewInput) =>
  request(async () => {
    await api.post(`/health/appointments/${enc(code)}/review`, reviewBody(input));
    return api.get(`/health/appointments/${enc(code)}`);
  }, raw => appointmentDetailSerializer(raw));
