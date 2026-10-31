// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Reviews Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// Read them, and rate a completed visit.
// MetroMatrix-API docs/API_HEALTH.md §2 (Review), §4.1, §4.2.

import { API, toApiError, clean, pageParams } from '../network/network';
import { reviewTagCodes } from '../../models/health/reviewFormModel';
import type { ConsultKind, DoctorReviewInput } from '../../models/health';

const enc = encodeURIComponent;

export type DoctorReviewSort = 'recent' | 'highest' | 'lowest';

export const fetchDoctorReviews = async (doctorId: string, filter: { kind: ConsultKind | null; sort: DoctorReviewSort; rating?: number | null }, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/health/doctors/${enc(doctorId)}/reviews`, params: clean({
          kind: filter.kind,
          sort: filter.sort === 'recent' ? 'latest' : filter.sort,
          rating: filter.rating,
          ...pageParams(page, pageSize),
        }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

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
/** The caller reads the appointment again. */
export const reviewAppointment = async (code: string, input: DoctorReviewInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/health/appointments/${enc(code)}/review`, data: reviewBody(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
