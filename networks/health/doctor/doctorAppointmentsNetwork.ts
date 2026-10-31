// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Doctor Appointments Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// Queue, calendar, an appointment and its actions.
// MetroMatrix-API docs/API_HEALTH.md §4.3. Doctor routes take the appointment
// CODE, which is what the doctor side calls an appointment's id. An action
// answers with the appointment's core; the screen redraws from the whole of
// it (notes and prescription too), so the slice reads it back
// (screens/Health/Doctor/shared/doctorAppointmentReads.ts).

import { api, toApiError } from '../../network/apiHelpers';
import { mimeFromUrl, publicIdFromCloudinaryUrl } from '../../../serializers/health/healthCommon';

const enc = encodeURIComponent;
const path = (id: string) => `/health/doctor/appointments/${enc(id)}`;

/** Today's queue, its counts and the practice's day. */
export const getDoctorTodayAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/health/doctor/today');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The doctor's appointments: one `date`, or a `from`–`to` range. */
export const getDoctorAppointmentsAPI = async (params: {
  date?: string;
  from?: string;
  to?: string;
  pageSize?: number;
}): Promise<unknown> => {
  try {
    const response = await api.get('/health/doctor/appointments', { params });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The appointment with its history and shared records. */
export const getDoctorAppointmentAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(path(id));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Its private notes. */
export const getAppointmentNotesAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`${path(id)}/notes`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Its prescription, when one was written. */
export const getAppointmentPrescriptionAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`${path(id)}/prescription`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export type DoctorAction = 'check-in' | 'start' | 'no-show';

export const actOnAppointmentAPI = async (id: string, action: DoctorAction): Promise<unknown> => {
  try {
    const response = await api.post(`${path(id)}/${action}`, {});
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const completeAppointmentAPI = async (id: string, paymentCollected: boolean): Promise<unknown> => {
  try {
    const response = await api.post(`${path(id)}/complete`, { paymentCollected });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const cancelByDoctorAPI = async (id: string, reason: string): Promise<unknown> => {
  try {
    const response = await api.post(`${path(id)}/cancel`, { reason });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const confirmPaymentAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.post(`${path(id)}/payment/confirm`, {});
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const rejectPaymentAPI = async (id: string, reason: string): Promise<unknown> => {
  try {
    const response = await api.post(`${path(id)}/payment/reject`, { reason });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Private notes; files are `medical_note` uploads (the API checks each one's public id). */
export const saveNotesAPI = async (id: string, notes: { text: string; attachments: string[] }): Promise<unknown> => {
  try {
    const response = await api.put(`${path(id)}/notes`, {
      text: notes.text,
      files: notes.attachments.map(url => ({ url, publicId: publicIdFromCloudinaryUrl(url), mime: mimeFromUrl(url) })),
    });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/**
 * A record the patient shared with this visit, with short-lived links to its
 * files (only while it is attached; the read is audited).
 */
export const openSharedRecordAPI = async (id: string, recordId: string): Promise<unknown> => {
  try {
    const response = await api.get(`${path(id)}/records/${enc(recordId)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
