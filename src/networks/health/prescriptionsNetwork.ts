// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Prescriptions Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// MetroMatrix-API docs/API_HEALTH.md §2 (Prescription), §4.2.

import { api, toApiError, pageParams } from '../network/apiHelpers';

export const getPrescriptionsAPI = async (page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await api.get('/health/prescriptions', { params: pageParams(page, pageSize) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getPrescriptionAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`/health/prescriptions/${encodeURIComponent(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
