// ═══════════════════════════════════════════════════════
// MetroMatrix — Appointment serializers (patient side)
// ═══════════════════════════════════════════════════════
// `PatientAppointment` (MetroMatrix-API docs/API_HEALTH.md §2): times carry
// the location's offset, the doctor and location are nested, payment is its
// own object, and every action is a `can.*` flag.

import type {
  AppointmentDetail,
  AppointmentDoctorRef,
  AppointmentEvent,
  AppointmentLocationRef,
  AppointmentPayment,
  AppointmentPaymentStatus,
  AppointmentStatus,
  AppointmentSummary,
  ReasonTag,
} from '../../types/health';
import type { PaymentInstructions, PaymentProof } from '../../types/payments';
import { arr, bool, enumList, isObject, num, oneOf, str, strOrNull, fromResponse } from '../serializerUtils';
import { compact, iso, money, paged } from '../shopping/common';
import {
  KINDS,
  appointmentStatus,
  doctorName,
  eventType,
  gender,
  instant,
  numOrNull,
  paymentMethod,
  paymentStatus,
  specialtyRefSerializer,
  timezone,
} from './healthCommon';
import { healthRecordSerializer } from './recordsSerializer';

const MINUTE = 60_000;
/** The video room opens this long before the start (docs/VIDEO.md). */
const JOIN_EARLY_MIN = 10;
const ACCOUNT_KINDS = ['raast', 'jazzcash', 'easypaisa', 'bank'] as const;
const REASON_TAGS: readonly ReasonTag[] = ['follow_up', 'new_problem', 'reports_review'];

/** The app's status vocabularies (each has its wording in appointmentStatusModel). */
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
  'void',
  'refund_due',
  'refunded',
];

/** The visit's reason chips travel as the API's `symptoms` list. */
export const reasonTags = (v: unknown) => enumList(v, REASON_TAGS);

export const doctorRefSerializer = (raw: unknown): AppointmentDoctorRef => {
  const r = isObject(raw) ? raw : {};
  return { id: str(r.id), name: doctorName(r), photoUrl: strOrNull(r.photoUrl), specialty: specialtyRefSerializer(r.specialty) };
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
    address: strOrNull(r.addressLine ?? r.address),
    lat: numOrNull(r.lat),
    lng: numOrNull(r.lng),
    phone: strOrNull(r.phone),
    instructions: strOrNull(r.instructions),
  };
};

/** A timeline row `{ kind, from, to, note, at }`; rows the app has no words for are dropped. */
export const eventSerializer = (raw: unknown): AppointmentEvent | null => {
  if (!isObject(raw)) return null;
  const type = eventType(raw);
  return type ? { type, note: strOrNull(raw.note), createdAt: iso(instant(raw.at)) } : null;
};

/** When the transfer proof went in: the last `proof_submitted` row of the timeline. */
const proofSentAt = (events: unknown): string | null =>
  arr(events)
    .filter(isObject)
    .filter(e => str(e.kind) === 'payment' && str(e.to) === 'proof_submitted')
    .map(e => instant(e.at))
    .filter((t): t is string => !!t)
    .pop() ?? null;

/**
 * `payment: { method, status, payBy, paymentRef, proofUrl, rejectedReason,
 * accounts }` → what to pay, where, by when, and the proof sent. A transfer
 * with no deadline is due before the consultation.
 */
export const paymentSerializer = (raw: unknown, fee: number, startAt: string, events?: unknown): AppointmentPayment => {
  const p = isObject(raw) ? raw : {};
  const method = paymentMethod(p.method);
  const account = arr(p.accounts).find(isObject);
  const instructions: PaymentInstructions | null =
    method === 'transfer' && account && str(account.accountNumber)
      ? {
          kind: oneOf(account.kind, ACCOUNT_KINDS, 'bank'),
          accountTitle: str(account.accountTitle),
          accountNumber: str(account.accountNumber),
          bankName: strOrNull(account.bankName),
          amount: fee,
          payBy: instant(p.payBy) ?? startAt,
        }
      : null;
  const ref = strOrNull(p.paymentRef);
  const proof: PaymentProof | null = ref
    ? {
        transactionId: ref,
        imageUrl: strOrNull(p.proofUrl),
        submittedAt: proofSentAt(events) ?? iso(null),
        rejectionReason: strOrNull(p.rejectedReason),
      }
    : null;
  return { method, status: paymentStatus(p), amount: fee, instructions, proof };
};

export const appointmentSummarySerializer = (raw: unknown): AppointmentSummary | null => {
  if (!isObject(raw)) return null;
  const code = str(raw.code);
  const startAt = instant(raw.startsAt);
  if (!code || !startAt) return null;
  const pay = isObject(raw.payment) ? raw.payment : {};
  const can = isObject(raw.can) ? raw.can : {};
  const loc = isObject(raw.location) ? raw.location : {};
  const patient = isObject(raw.patient) ? raw.patient : {};
  const kind = oneOf(raw.kind, KINDS, 'clinic');
  return {
    id: str(raw.id, code),
    code,
    status: appointmentStatus(raw.status, pay),
    kind,
    startAt,
    endAt: instant(raw.endsAt) ?? new Date(Date.parse(startAt) + 15 * MINUTE).toISOString(),
    timezone: timezone(loc.timezone),
    doctor: doctorRefSerializer(raw.doctor),
    location: locationRefSerializer(raw.location),
    patientName: str(patient.name, 'Patient'),
    fee: money(raw.fee),
    paymentStatus: paymentStatus(pay),
    canJoinVideo: kind === 'video' && bool(can.joinVideo),
    canPay: bool(can.submitPaymentProof),
    canReview: bool(can.review),
    // TODO(API_HEALTH): not sent; docs/VIDEO.md opens the room 10 minutes before the start.
    joinOpensAt: kind === 'video' ? new Date(Date.parse(startAt) - JOIN_EARLY_MIN * MINUTE).toISOString() : null,
  };
};

const UPCOMING = ['awaiting_payment', 'confirmed'];

export const appointmentDetailSerializer = fromResponse((raw: unknown, now: number = Date.now()): AppointmentDetail | null => {
  const summary = appointmentSummarySerializer(raw);
  if (!summary || !isObject(raw)) return null;
  const p = isObject(raw.patient) ? raw.patient : {};
  const can = isObject(raw.can) ? raw.can : {};
  // TODO(API_HEALTH): A5 — derived from cancelCutoffAt; the server marks lateCancel when it happens.
  const cutoff = instant(raw.cancelCutoffAt);
  const late = !!cutoff && UPCOMING.includes(summary.status) && now >= Date.parse(cutoff) && now < Date.parse(summary.startAt);
  const noticeHours = cutoff ? Math.round((Date.parse(summary.startAt) - Date.parse(cutoff)) / 3_600_000) : 0;
  return {
    ...summary,
    patient: {
      familyMemberId: strOrNull(raw.familyMemberId),
      name: str(p.name, summary.patientName),
      relation: strOrNull(p.relation),
      age: numOrNull(p.age),
      gender: gender(p.gender),
    },
    reasonTags: reasonTags(raw.symptoms),
    reason: strOrNull(raw.reason),
    records: compact(arr(raw.sharedRecords).map(healthRecordSerializer)),
    payment: paymentSerializer(raw.payment, summary.fee, summary.startAt, raw.events),
    timeline: compact(arr(raw.events).map(eventSerializer)),
    flags: {
      canCancel: bool(can.cancel),
      canReschedule: bool(can.reschedule),
      canJoinVideo: summary.canJoinVideo,
      canReview: bool(can.review),
      canPay: bool(can.submitPaymentProof),
      canAttachRecords: bool(can.shareRecords),
    },
    isLateCancel: late,
    lateCancelNote: late
      ? `This is within the doctor's ${noticeHours}-hour notice, so it counts as a late cancellation. Please give notice next time if you can.`
      : null,
    cancelReason: strOrNull(raw.cancelReason),
    // One reschedule per visit: a rescheduled visit can't move again.
    rescheduleCount: strOrNull(raw.rescheduledFromId) ? 1 : 0,
    prescriptionId: strOrNull(raw.prescriptionId),
    reviewed: bool(raw.reviewed),
  };
});

/** `409 SLOT_TAKEN` details `{ alternatives: [{ startsAt, endsAt }] }` → the times offered. */
export const alternativesFrom = (details: Record<string, unknown> | null | undefined): string[] =>
  compact(arr(details?.alternatives).map(a => (isObject(a) ? instant(a.startsAt ?? a.startAt) : instant(a)))).slice(0, 3);

/** Count of minutes, defensive (used by queue and history readers). */
export const minutes = (v: unknown) => Math.max(0, Math.round(num(v)));

/** A page of appointmentSummarys, as the API answers it. */
export const appointmentSummaryPageSerializer = fromResponse(raw => paged(raw, appointmentSummarySerializer));
