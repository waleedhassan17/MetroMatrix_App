// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Doctor Appointments Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// Queue, calendar, an appointment and its actions.
// MetroMatrix-API docs/API_HEALTH.md §4.3. Doctor routes take the appointment
// CODE, which is what the doctor side calls an appointment's id. An action
// answers with the appointment's core; the screen redraws from the whole of
// it (notes and prescription too), so the slice reads it back
// (screens/Health/Doctor/shared/doctorAppointmentReads.ts).

import { API, toApiError } from '../../network/network';
import { mimeFromUrl, publicIdFromCloudinaryUrl } from '../../../serializers/health/healthCommon';
import type { DoctorNeed, WalkInInput } from '../../../models/health';

const enc = encodeURIComponent;
const path = (id: string) => `/health/doctor/appointments/${enc(id)}`;

/** Today's queue, its counts and the practice's day. */
export const fetchDoctorToday = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/health/doctor/today' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * The doctor's appointments: one `date` (a Pakistan-time day), or instants
 * `from` (inclusive) – `to` (exclusive), or what one "Needs you" count
 * counts (`needs`, any date).
 */
export const fetchDoctorAppointments = async (params: {
  date?: string;
  from?: string;
  to?: string;
  needs?: DoctorNeed;
  page?: number;
  pageSize?: number;
}): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/health/doctor/appointments', params });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The appointment with its history and shared records. */
export const fetchDoctorAppointment = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: path(id) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Its private notes. */
export const fetchAppointmentNotes = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${path(id)}/notes` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Its prescription, when one was written. */
export const fetchAppointmentPrescription = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${path(id)}/prescription` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export type DoctorAction = 'check-in' | 'start' | 'no-show';

export const actOnAppointment = async (id: string, action: DoctorAction): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${path(id)}/${action}`, data: {} });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const completeAppointment = async (id: string, paymentCollected: boolean): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${path(id)}/complete`, data: { paymentCollected } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const cancelByDoctor = async (id: string, reason: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${path(id)}/cancel`, data: { reason } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const confirmPayment = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${path(id)}/payment/confirm`, data: {} });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const rejectPayment = async (id: string, reason: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${path(id)}/payment/reject`, data: { reason } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A fee owed back after a cancellation, sent outside MetroMatrix: `refund_due → refunded`. */
export const refundAppointment = async (id: string, refundRef: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${path(id)}/refund`, data: { refundRef } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Private notes; files are `medical_note` uploads (the API checks each one's public id). */
export const saveNotes = async (id: string, notes: { text: string; attachments: string[] }): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: `${path(id)}/notes`, data: {
      text: notes.text,
      files: notes.attachments.map(url => ({ url, publicId: publicIdFromCloudinaryUrl(url), mime: mimeFromUrl(url) })),
    } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * A record the patient shared with this visit, with short-lived links to its
 * files (only while it is attached; the read is audited).
 */
export const openSharedRecord = async (id: string, recordId: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `${path(id)}/records/${enc(recordId)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A clinic fee taken at the desk or after the visit (pay at clinic, unpaid → paid). */
export const markPaid = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${path(id)}/payment/mark-paid`, data: {} });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

const moveBody = (move: { startAt: string; locationId: string | null; reason: string }) => ({
  startsAt: move.startAt,
  locationId: move.locationId ?? undefined,
  reason: move.reason,
});

/** Move a booked visit to another of your free times; the patient is told why. */
export const moveAppointment = async (id: string, move: { startAt: string; locationId: string | null; reason: string }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${path(id)}/reschedule`, data: moveBody(move) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Book the follow-up of a started or completed visit for the same person. */
export const bookFollowUp = async (id: string, followUp: { locationId: string; startAt: string }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${path(id)}/follow-up`, data: { locationId: followUp.locationId, startsAt: followUp.startAt } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

const walkInBody = (input: WalkInInput) => ({
  locationId: input.locationId,
  startsAt: input.startAt ?? undefined,
  patient: {
    name: input.name.trim(),
    phone: input.phone.trim() || undefined,
    gender: input.gender ?? undefined,
    age: input.age ?? undefined,
  },
  reason: input.reason.trim() || undefined,
});

/** Someone at the clinic desk without a booking: checked in at once (a free slot today). */
export const addWalkIn = async (input: WalkInInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/health/doctor/appointments/walk-in', data: walkInBody(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
