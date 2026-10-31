// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Prescriptions Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// MetroMatrix-API docs/API_HEALTH.md §2 (Prescription), §4.2.

import { API, toApiError, pageParams } from '../network/network';

export const fetchPrescriptions = async (page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/health/prescriptions', params: pageParams(page, pageSize) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchPrescription = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/health/prescriptions/${encodeURIComponent(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
