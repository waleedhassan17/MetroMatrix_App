// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Appointments Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// Book, list, reschedule, cancel, pay, attach.
// MetroMatrix-API docs/API_HEALTH.md §4.2.

import { api, toApiError, pageParams } from '../network/apiHelpers';
import { cancelReasonText } from '../../models/health/bookingModel';
import { newUuid } from '../../utils/ids';
import type { AppointmentSegment, BookingInput, CancelReason } from '../../types/health';

const path = (code: string) => `/health/appointments/${encodeURIComponent(code)}`;

/** The booking body: the reason chips travel as `symptoms`, shared records as `attachmentRecordIds`. */
const bookingBody = (input: BookingInput) => ({
  doctorId: input.doctorId,
  locationId: input.locationId,
  startsAt: input.startAt,
  familyMemberId: input.familyMemberId ?? undefined,
  reason: input.reason ?? undefined,
  symptoms: input.reasonTags,
  attachmentRecordIds: input.recordIds.length ? input.recordIds : undefined,
  paymentMethod: input.paymentMethod === 'transfer' ? 'transfer' : 'pay_at_clinic',
});

/**
 * The same `idempotencyKey` on a retry returns the appointment the first
 * attempt made — never a second one. A slot someone else took first answers
 * 409 SLOT_TAKEN with `details.alternatives` (alternativesFrom()).
 */
export const bookAppointmentAPI = async (input: BookingInput, idempotencyKey: string): Promise<unknown> => {
  try {
    const response = await api.post('/health/appointments', bookingBody(input), { headers: { 'Idempotency-Key': idempotencyKey } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getAppointmentsAPI = async (segment: AppointmentSegment, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await api.get('/health/appointments', { params: { scope: segment, ...pageParams(page, pageSize) } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getAppointmentAPI = async (code: string): Promise<unknown> => {
  try {
    const response = await api.get(path(code));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The API keeps one free-text reason: the chip's words, and the note when there is one. */
export const cancelAppointmentAPI = async (code: string, reason: CancelReason, note: string | null): Promise<unknown> => {
  try {
    const response = await api.post(`${path(code)}/cancel`, { reason: cancelReasonText(reason, note) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * The new time is a NEW appointment with its own code (the old one is
 * void); the answer is the new one. Its own Idempotency-Key per attempt.
 */
export const rescheduleAppointmentAPI = async (code: string, startAt: string): Promise<unknown> => {
  try {
    const response = await api.post(`${path(code)}/reschedule`, { startsAt: startAt }, { headers: { 'Idempotency-Key': newUuid() } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The transaction ID (and a screenshot uploaded for `payment_proof`); the caller reads the appointment again. */
export const submitAppointmentPaymentProofAPI = async (code: string, body: { transactionId: string; imageUrl: string | null }): Promise<unknown> => {
  try {
    const response = await api.post(`${path(code)}/payment-proof`, { paymentRef: body.transactionId, proofUrl: body.imageUrl ?? undefined });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Share records with the visit (while it's upcoming); the caller reads the appointment again. */
export const attachRecordsAPI = async (code: string, recordIds: string[]): Promise<unknown> => {
  try {
    const response = await api.post(`${path(code)}/attachments`, { recordIds });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
