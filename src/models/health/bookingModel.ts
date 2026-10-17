// MetroMatrix — Booking, rescheduling and cancelling an appointment.

import type {
  AppointmentPaymentMethod,
  BookingInput,
  CancelReason,
  PracticeLocation,
  ReasonTag,
} from '../../types/health';
import type { ValidationErrors } from '../authModel';

export const REASON_TAGS: { key: ReasonTag; label: string }[] = [
  { key: 'follow_up', label: 'Follow-up' },
  { key: 'new_problem', label: 'New problem' },
  { key: 'reports_review', label: 'Reports review' },
];

export const CANCEL_REASONS: { key: CancelReason; label: string }[] = [
  { key: 'feeling_better', label: 'Feeling better' },
  { key: 'schedule_clash', label: 'Schedule clash' },
  { key: 'booked_by_mistake', label: 'Booked by mistake' },
  { key: 'other_doctor', label: 'Seeing another doctor' },
  { key: 'other', label: 'Something else' },
];

/** The cancel reason as the API keeps it: one line of text ("Schedule clash: travelling"). */
export const cancelReasonText = (reason: CancelReason, note: string | null): string => {
  const label = CANCEL_REASONS.find(r => r.key === reason)?.label ?? 'Cancelled by the patient';
  const extra = (note ?? '').trim();
  return extra ? `${label}: ${extra}` : label;
};

export const MAX_REASON = 300;
export const MAX_ATTACHED_RECORDS = 10;

/**
 * How the patient may pay for this location. A clinic visit is paid at the
 * clinic (no choice to make). A video consultation is paid at the consult
 * or by transfer, and only by transfer when the doctor asks for prepayment.
 */
/** Clinic visits are paid at the clinic; video is always a transfer to the doctor (API_HEALTH §4.2). */
export const paymentOptionsFor = (location: Pick<PracticeLocation, 'kind' | 'requiresPrepay'>): AppointmentPaymentMethod[] =>
  location.kind === 'clinic' ? ['pay_at_visit'] : ['transfer'];

export const defaultPaymentFor = (location: Pick<PracticeLocation, 'kind' | 'requiresPrepay'>): AppointmentPaymentMethod =>
  paymentOptionsFor(location)[0];

export const validateBooking = (b: Pick<BookingInput, 'startAt' | 'reason' | 'recordIds'>): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!b.startAt) errors.startAt = 'Choose a time';
  if ((b.reason ?? '').length > MAX_REASON) errors.reason = `Keep it under ${MAX_REASON} characters`;
  if (b.recordIds.length > MAX_ATTACHED_RECORDS) errors.recordIds = `Attach up to ${MAX_ATTACHED_RECORDS} records`;
  return errors;
};

export const validateCancel = (reason: CancelReason | null, note: string): ValidationErrors => {
  if (!reason) return { reason: 'Choose a reason' };
  if (reason === 'other' && note.trim().length < 3) return { note: 'Tell the doctor briefly why' };
  if (note.length > MAX_REASON) return { note: `Keep it under ${MAX_REASON} characters` };
  return {};
};
