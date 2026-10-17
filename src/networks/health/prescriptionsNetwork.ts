// MetroMatrix — The patient's prescriptions.
// MetroMatrix-API docs/API_HEALTH.md §2 (Prescription), §4.2.

import { api } from '../network/apiHelpers';
import { prescriptionSerializer, prescriptionSummarySerializer } from '../../serializers/health/recordsSerializer';
import { paged } from '../../serializers/shopping/common';
import { pageParams, request } from '../shopping/http';

export const listPrescriptions = (page: number, pageSize = 20) =>
  request(() => api.get('/health/prescriptions', { params: pageParams(page, pageSize) }), raw => paged(raw, prescriptionSummarySerializer));

export const getPrescription = (id: string) =>
  request(() => api.get(`/health/prescriptions/${encodeURIComponent(id)}`), prescriptionSerializer);
