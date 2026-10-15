// ═══════════════════════════════════════════════════════
// MetroMatrix — Appointment and payment status (the ONE Health map)
// ═══════════════════════════════════════════════════════
// Raw status strings never reach the UI: every label, tone and line of
// explanation comes from here. Health never uses the `danger` tone; red is
// kept for emergencies only, so a cancelled visit reads neutral.

import type { TimelineStep } from '../../Custom-Components/StatusTimeline';
import type {
  AppointmentEventType,
  AppointmentPaymentMethod,
  AppointmentPaymentStatus,
  AppointmentSegment,
  AppointmentStatus,
  ConsultKind,
} from '../../types/health';
import type { StatusMeta } from '../shopping/orderStatusModel';

export const APPOINTMENT_STATUS: Record<AppointmentStatus, StatusMeta> = {
  awaiting_payment: {
    label: 'Payment needed',
    tone: 'warning',
    description: 'Send the fee before the deadline to keep this time.',
  },
  confirmed: { label: 'Confirmed', tone: 'accent', description: 'Your appointment is confirmed.' },
  checked_in: { label: 'Checked in', tone: 'accent', description: 'You are in the queue. The doctor will see you soon.' },
  in_progress: { label: 'In consultation', tone: 'accent', description: 'Your consultation has started.' },
  completed: { label: 'Completed', tone: 'success', description: 'This visit is complete.' },
  cancelled: { label: 'Cancelled', tone: 'neutral', description: 'This appointment was cancelled.' },
  no_show: { label: 'Missed', tone: 'warning', description: 'This appointment was marked as missed.' },
};

export const APPOINTMENT_PAYMENT_STATUS: Record<AppointmentPaymentStatus, StatusMeta> = {
  pay_at_visit: { label: 'Pay at visit', tone: 'neutral', description: 'Pay the doctor at your appointment.' },
  awaiting_transfer: { label: 'Payment needed', tone: 'warning', description: 'Transfer the fee, then share the transaction ID.' },
  proof_submitted: { label: 'Payment in review', tone: 'accent', description: 'The doctor is checking your transfer.' },
  proof_rejected: { label: 'Payment not found', tone: 'warning', description: 'The doctor could not find your transfer.' },
  paid: { label: 'Paid', tone: 'success', description: 'The doctor has confirmed your payment.' },
  collected: { label: 'Paid at visit', tone: 'success', description: 'The fee was paid at the visit.' },
};

export const PAYMENT_METHOD_LABEL: Record<AppointmentPaymentMethod, string> = {
  pay_at_visit: 'Pay at visit',
  transfer: 'Transfer before the consultation',
};

export const KIND_LABEL: Record<ConsultKind, string> = {
  video: 'Video consultation',
  clinic: 'Clinic visit',
};

/** The icon for a consultation kind (Ionicons). */
export const KIND_ICON: Record<ConsultKind, 'videocam-outline' | 'business-outline'> = {
  video: 'videocam-outline',
  clinic: 'business-outline',
};

export const APPOINTMENT_SEGMENTS: { key: AppointmentSegment; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
];

const EVENT_LABEL: Record<AppointmentEventType, string> = {
  booked: 'Booked',
  payment_proof_submitted: 'Payment proof sent',
  payment_confirmed: 'Payment confirmed',
  payment_rejected: 'Payment not found',
  confirmed: 'Confirmed',
  rescheduled: 'Rescheduled',
  checked_in: 'Checked in',
  in_progress: 'Consultation started',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'Marked as missed',
  prescription_issued: 'Prescription issued',
};

export const eventLabel = (type: AppointmentEventType): string => EVENT_LABEL[type] ?? 'Update';

const MAIN_PATH: AppointmentStatus[] = ['confirmed', 'checked_in', 'in_progress', 'completed'];

/**
 * The appointment's progress as timeline steps: Booked, (payment), then the
 * main path up to where it is. A cancelled or missed visit ends on that step
 * (shown as current, never as a red failure).
 */
export const appointmentTimeline = (status: AppointmentStatus, kind: ConsultKind, needsTransfer: boolean): TimelineStep[] => {
  const steps: TimelineStep[] = [{ label: 'Booked', state: 'done' }];
  if (needsTransfer) {
    steps.push({ label: 'Payment', state: status === 'awaiting_payment' ? 'current' : 'done' });
  }
  if (status === 'cancelled' || status === 'no_show') {
    steps.push({ label: APPOINTMENT_STATUS[status].label, description: APPOINTMENT_STATUS[status].description, state: 'current' });
    return steps;
  }
  const at = MAIN_PATH.indexOf(status);
  const path = kind === 'video' ? MAIN_PATH.filter(s => s !== 'checked_in') : MAIN_PATH;
  for (const s of path) {
    const i = MAIN_PATH.indexOf(s);
    const state = at < 0 ? 'upcoming' : i < at ? 'done' : i === at ? (s === 'completed' ? 'done' : 'current') : 'upcoming';
    steps.push({ label: APPOINTMENT_STATUS[s].label, description: i === at ? APPOINTMENT_STATUS[s].description : undefined, state });
  }
  return steps;
};

/** Upcoming means it can still happen; everything else is past. */
export const isUpcomingStatus = (status: AppointmentStatus) =>
  status === 'awaiting_payment' || status === 'confirmed' || status === 'checked_in' || status === 'in_progress';
