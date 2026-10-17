// MetroMatrix — The patient's appointments: book, list, reschedule, cancel, pay, attach.
// MetroMatrix-API docs/API_HEALTH.md §4.2.

import { api } from '../network/apiHelpers';
import { appointmentDetailSerializer, appointmentSummarySerializer } from '../../serializers/health/appointmentSerializer';
import { paged } from '../../serializers/shopping/common';
import { cancelReasonText } from '../../models/health/bookingModel';
import { newUuid } from '../../utils/ids';
import type { AppointmentSegment, BookingInput, CancelReason } from '../../types/health';
import { pageParams, request } from '../shopping/http';

const path = (code: string) => `/health/appointments/${encodeURIComponent(code)}`;
const detail = (raw: unknown) => appointmentDetailSerializer(raw);

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
export const bookAppointment = (input: BookingInput, idempotencyKey: string) =>
  request(() => api.post('/health/appointments', bookingBody(input), { headers: { 'Idempotency-Key': idempotencyKey } }), detail);

export const listAppointments = (segment: AppointmentSegment, page: number, pageSize = 20) =>
  request(() => api.get('/health/appointments', { params: { scope: segment, ...pageParams(page, pageSize) } }), raw =>
    paged(raw, appointmentSummarySerializer),
  );

export const getAppointment = (code: string) => request(() => api.get(path(code)), detail);

/** The API keeps one free-text reason: the chip's words, and the note when there is one. */
export const cancelAppointment = (code: string, reason: CancelReason, note: string | null) =>
  request(() => api.post(`${path(code)}/cancel`, { reason: cancelReasonText(reason, note) }), detail);

/**
 * The new time is a NEW appointment with its own code (the old one is
 * void); the answer is the new one. Its own Idempotency-Key per attempt.
 */
export const rescheduleAppointment = (code: string, startAt: string) =>
  request(() => api.post(`${path(code)}/reschedule`, { startsAt: startAt }, { headers: { 'Idempotency-Key': newUuid() } }), detail);

/** The transaction ID (and a screenshot uploaded for `payment_proof`), then the appointment as it now is. */
export const submitAppointmentPaymentProof = (code: string, body: { transactionId: string; imageUrl: string | null }) =>
  request(async () => {
    await api.post(`${path(code)}/payment-proof`, { paymentRef: body.transactionId, proofUrl: body.imageUrl ?? undefined });
    return api.get(path(code));
  }, detail);

/** Share records with the visit (while it's upcoming), then the appointment as it now is. */
export const attachRecords = (code: string, recordIds: string[]) =>
  request(async () => {
    await api.post(`${path(code)}/attachments`, { recordIds });
    return api.get(path(code));
  }, detail);
