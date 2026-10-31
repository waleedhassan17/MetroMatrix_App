// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Doctor Patients Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// MetroMatrix-API docs/API_HEALTH.md §4.3; a patient is a person (`patientKey`).

import { API, toApiError, clean, pageParams } from '../../network/network';

export const fetchPatients = async (q: string, page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/health/doctor/patients', params: clean({ q, ...pageParams(page, pageSize) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The history with this doctor only (audited). */
export const fetchPatientHistory = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/health/doctor/patients/${encodeURIComponent(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
