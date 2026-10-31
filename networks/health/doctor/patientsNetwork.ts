// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Doctor Patients Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// MetroMatrix-API docs/API_HEALTH.md §4.3; a patient is a person (`patientKey`).

import { api, toApiError, clean, pageParams } from '../../network/apiHelpers';

export const getPatientsAPI = async (q: string, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await api.get('/health/doctor/patients', { params: clean({ q, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The history with this doctor only (audited). */
export const getPatientHistoryAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`/health/doctor/patients/${encodeURIComponent(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
