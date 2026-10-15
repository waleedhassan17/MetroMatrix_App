// MetroMatrix — Appointment serializers (patient side).
// TODO(API_HEALTH): shapes from docs/API_HEALTH_ASSUMED.md.

import type {
  AppointmentDetail,
  AppointmentDoctorRef,
  AppointmentEvent,
  AppointmentEventType,
  AppointmentLocationRef,
  AppointmentPayment,
  AppointmentPaymentMethod,
  AppointmentPaymentStatus,
  AppointmentStatus,
  AppointmentSummary,
  ReasonTag,
} from '../../types/health';
import { arr, bool, enumList, isObject, num, oneOf, str, strOrNull } from '../serializerUtils';
import { compact, count, iso, isoOrNull, money } from '../shopping/common';
import { instructionsSerializer, proofSerializer } from '../shopping/orderSerializer';
import { KINDS, gender, numOrNull, specialtyRefSerializer, timezone } from './healthCommon';
import { healthRecordSerializer } from './recordsSerializer';

export const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  'awaiting_payment',
  'confirmed',
  'checked_in',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
];
export const APPOINTMENT_PAYMENT_STATUSES: readonly AppointmentPaymentStatus[] = [
  'pay_at_visit',
  'awaiting_transfer',
  'proof_submitted',
  'proof_rejected',
  'paid',
  'collected',
];
const METHODS: readonly AppointmentPaymentMethod[] = ['pay_at_visit', 'transfer'];
const REASON_TAGS: readonly ReasonTag[] = ['follow_up', 'new_problem', 'reports_review'];
const EVENTS: readonly AppointmentEventType[] = [
  'booked',
  'payment_proof_submitted',
  'payment_confirmed',
  'payment_rejected',
  'confirmed',
  'rescheduled',
  'checked_in',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
  'prescription_issued',
];

export const reasonTags = (v: unknown) => enumList(v, REASON_TAGS);

export const doctorRefSerializer = (raw: unknown): AppointmentDoctorRef => {
  const r = isObject(raw) ? raw : {};
  return { id: str(r.id), name: str(r.name, 'Doctor'), photoUrl: strOrNull(r.photoUrl), specialty: specialtyRefSerializer(r.specialty) };
};

export const locationRefSerializer = (raw: unknown): AppointmentLocationRef => {
  const r = isObject(raw) ? raw : {};
  const kind = oneOf(r.kind, KINDS, 'clinic');
  return {
    id: str(r.id),
    kind,
    name: str(r.name, kind === 'video' ? 'Video consultation' : 'Clinic'),
    area: str(r.area),
    city: str(r.city),
    address: strOrNull(r.address),
    lat: numOrNull(r.lat),
    lng: numOrNull(r.lng),
    phone: strOrNull(r.phone),
    instructions: strOrNull(r.instructions),
  };
};

export const eventSerializer = (raw: unknown): AppointmentEvent | null => {
  if (!isObject(raw)) return null;
  const type = oneOf(raw.type, EVENTS, null);
  return type ? { type, note: strOrNull(raw.note), createdAt: iso(raw.createdAt) } : null;
};

export const paymentSerializer = (raw: unknown): AppointmentPayment => {
  const r = isObject(raw) ? raw : {};
  return {
    method: oneOf(r.method, METHODS, 'pay_at_visit'),
    status: oneOf(r.status, APPOINTMENT_PAYMENT_STATUSES, 'pay_at_visit'),
    amount: money(r.amount),
    instructions: instructionsSerializer(r.instructions),
    proof: proofSerializer(r.proof),
  };
};

export const appointmentSummarySerializer = (raw: unknown): AppointmentSummary | null => {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const code = str(raw.code);
  const startAt = isoOrNull(raw.startAt);
  if (!id || !code || !startAt) return null;
  const kind = oneOf(raw.kind, KINDS, 'clinic');
  return {
    id,
    code,
    status: oneOf(raw.status, APPOINTMENT_STATUSES, 'confirmed'),
    kind,
    startAt,
    endAt: isoOrNull(raw.endAt) ?? new Date(Date.parse(startAt) + 15 * 60_000).toISOString(),
    timezone: timezone(raw.timezone),
    doctor: doctorRefSerializer(raw.doctor),
    location: locationRefSerializer(raw.location),
    patientName: str(raw.patientName),
    fee: money(raw.fee),
    paymentStatus: oneOf(raw.paymentStatus, APPOINTMENT_PAYMENT_STATUSES, 'pay_at_visit'),
    canJoinVideo: kind === 'video' && bool(raw.canJoinVideo),
    canPay: bool(raw.canPay),
    canReview: bool(raw.canReview),
    joinOpensAt: kind === 'video' ? isoOrNull(raw.joinOpensAt) : null,
  };
};

export const appointmentDetailSerializer = (raw: unknown): AppointmentDetail | null => {
  const summary = appointmentSummarySerializer(raw);
  if (!summary || !isObject(raw)) return null;
  const p = isObject(raw.patient) ? raw.patient : {};
  const f = isObject(raw.flags) ? raw.flags : {};
  const payment = paymentSerializer(raw.payment);
  return {
    ...summary,
    patient: {
      familyMemberId: strOrNull(p.familyMemberId),
      name: str(p.name, summary.patientName),
      relation: strOrNull(p.relation),
      age: numOrNull(p.age),
      gender: gender(p.gender),
    },
    reasonTags: reasonTags(raw.reasonTags),
    reason: strOrNull(raw.reason),
    records: compact(arr(raw.records).map(healthRecordSerializer)),
    payment,
    timeline: compact(arr(raw.timeline).map(eventSerializer)),
    flags: {
      canCancel: bool(f.canCancel),
      canReschedule: bool(f.canReschedule),
      canJoinVideo: summary.kind === 'video' && bool(f.canJoinVideo),
      canReview: bool(f.canReview),
      canPay: bool(f.canPay),
      canAttachRecords: bool(f.canAttachRecords),
    },
    isLateCancel: bool(raw.isLateCancel),
    lateCancelNote: strOrNull(raw.lateCancelNote),
    cancelReason: strOrNull(raw.cancelReason),
    rescheduleCount: count(raw.rescheduleCount),
    prescriptionId: strOrNull(raw.prescriptionId),
    reviewed: bool(raw.reviewed),
  };
};

/** `409 SLOT_TAKEN` details → the alternatives the API offers. */
export const alternativesFrom = (details: Record<string, unknown> | null | undefined): string[] =>
  compact(
    arr(details?.alternatives).map(a => (isObject(a) ? isoOrNull(a.startAt) : isoOrNull(a))),
  ).slice(0, 3);

/** Count of minutes, defensive (used by queue and history readers). */
export const minutes = (v: unknown) => Math.max(0, Math.round(num(v)));
