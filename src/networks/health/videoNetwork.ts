// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Video Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// MetroMatrix-API docs/VIDEO.md. Outside the window: 409 VIDEO_NOT_JOINABLE
// (details.reason, opensAt); a prepaid visit not yet paid: 402 PAYMENT_REQUIRED.

import { api, toApiError } from '../network/apiHelpers';

/** The patient's join, by appointment code. */
export const joinVideoAPI = async (code: string): Promise<unknown> => {
  try {
    const response = await api.post(`/health/appointments/${encodeURIComponent(code)}/video/join`, {});
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The doctor's join (the doctor side's appointment id is its code); it starts the consultation. */
export const joinVideoAsDoctorAPI = async (appointmentId: string): Promise<unknown> => {
  try {
    const response = await api.post(`/health/doctor/appointments/${encodeURIComponent(appointmentId)}/video/join`, {});
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
