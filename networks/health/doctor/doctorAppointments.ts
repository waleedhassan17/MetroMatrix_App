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

/** The doctor's appointments: one `date`, or a `from`–`to` range. */
export const fetchDoctorAppointments = async (params: {
  date?: string;
  from?: string;
  to?: string;
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
