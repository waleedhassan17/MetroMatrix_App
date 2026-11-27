// MetroMatrix — Booking, rescheduling and cancelling an appointment.

import type {
  AppointmentPaymentMethod,
  BookingInput,
  CancelReason,
  PracticeLocation,
  ReasonTag,
  WalkInInput,
} from '../health';
import type { ValidationErrors } from '../authModel';
import type { Gender } from '../auth';
import { PK_MOBILE_MESSAGE, isValidPkMobile, normalizePkPhone } from '../../utils/phone/phone';

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

const MIN = 60_000;
/**
 * When a required prepayment is due, as the API sets it (appointments.service
 * `payBy`): two hours from booking, but at least 30 minutes before the start;
 * never under 10 minutes from now, and never after the start.
 */
export const prepayDeadline = (startAt: string, now: number): string => {
  const start = Date.parse(startAt);
  return new Date(Math.min(Math.max(now + 10 * MIN, Math.min(now + 120 * MIN, start - 30 * MIN)), start)).toISOString();
};

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

/** A walk-in as the form holds it (age as typed). */
export interface WalkInForm {
  locationId: string;
  name: string;
  phone: string;
  gender: Gender | null;
  age: string;
  reason: string;
}

export const MAX_WALK_IN_NAME = 120;
export const MAX_WALK_IN_REASON = 300;

/** The API's own rules (WalkInDto): a name, an optional PK mobile, an age 0–120. */
export const validateWalkIn = (f: WalkInForm): ValidationErrors => {
  const errors: ValidationErrors = {};
  const name = f.name.trim();
  if (name.length < 2) errors.name = 'Their name, as they give it';
  else if (name.length > MAX_WALK_IN_NAME) errors.name = `Keep it under ${MAX_WALK_IN_NAME} characters`;
  if (f.phone.trim() && !isValidPkMobile(f.phone)) errors.phone = PK_MOBILE_MESSAGE;
  if (f.age.trim()) {
    const n = Number(f.age);
    if (!Number.isInteger(n) || n < 0 || n > 120) errors.age = 'An age from 0 to 120';
  }
  if (f.reason.length > MAX_WALK_IN_REASON) errors.reason = `Keep it under ${MAX_WALK_IN_REASON} characters`;
  if (!f.locationId) errors.locationId = 'Choose the clinic';
  return errors;
};

/** The form as the API takes it (phone in +92 form, age a number). */
export const walkInToSave = (f: WalkInForm, startAt: string | null): WalkInInput => ({
  locationId: f.locationId,
  startAt,
  name: f.name.trim(),
  phone: normalizePkPhone(f.phone) ?? '',
  gender: f.gender,
  age: f.age.trim() ? Number(f.age) : null,
  reason: f.reason.trim(),
});
