// MetroMatrix — The patient's appointments: book, list, reschedule, cancel, pay, attach.
// TODO(API_HEALTH): paths and shapes from docs/API_HEALTH_ASSUMED.md.

import { api } from '../network/apiHelpers';
import { appointmentDetailSerializer, appointmentSummarySerializer } from '../../serializers/health/appointmentSerializer';
import { paged } from '../../serializers/shopping/common';
import type { AppointmentSegment, BookingInput, CancelReason } from '../../types/health';
import { pageParams, request } from '../shopping/http';

const path = (code: string) => `/healthcare/appointments/${encodeURIComponent(code)}`;

/**
 * The same `idempotencyKey` on a retry returns the appointment the first
 * attempt made — never a second one. A slot someone else took first answers
 * 409 SLOT_TAKEN with `details.alternatives` (alternativesFrom()).
 */
export const bookAppointment = (input: BookingInput, idempotencyKey: string) =>
  request(
    () => api.post('/healthcare/appointments', input, { headers: { 'Idempotency-Key': idempotencyKey } }),
    appointmentDetailSerializer,
  );

export const listAppointments = (segment: AppointmentSegment, page: number, pageSize = 20) =>
  request(() => api.get('/healthcare/appointments', { params: { segment, ...pageParams(page, pageSize) } }), raw =>
    paged(raw, appointmentSummarySerializer),
  );

export const getAppointment = (code: string) => request(() => api.get(path(code)), appointmentDetailSerializer);

export const cancelAppointment = (code: string, reason: CancelReason, note: string | null) =>
  request(() => api.post(`${path(code)}/cancel`, { reason, note }), appointmentDetailSerializer);

export const rescheduleAppointment = (code: string, startAt: string) =>
  request(() => api.post(`${path(code)}/reschedule`, { startAt }), appointmentDetailSerializer);

export const submitAppointmentPaymentProof = (code: string, body: { transactionId: string; imageUrl: string | null }) =>
  request(() => api.post(`${path(code)}/payment-proof`, body), appointmentDetailSerializer);

export const attachRecords = (code: string, recordIds: string[]) =>
  request(() => api.post(`${path(code)}/records`, { recordIds }), appointmentDetailSerializer);
