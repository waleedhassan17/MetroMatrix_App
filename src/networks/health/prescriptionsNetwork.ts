// MetroMatrix — The patient's prescriptions.
// TODO(API_HEALTH): paths and shapes from docs/API_HEALTH_ASSUMED.md.

import { api } from '../network/apiHelpers';
import { prescriptionSerializer, prescriptionSummarySerializer } from '../../serializers/health/recordsSerializer';
import { paged } from '../../serializers/shopping/common';
import { pageParams, request } from '../shopping/http';

export const listPrescriptions = (page: number, pageSize = 20) =>
  request(() => api.get('/healthcare/prescriptions', { params: pageParams(page, pageSize) }), raw =>
    paged(raw, prescriptionSummarySerializer),
  );

export const getPrescription = (id: string) =>
  request(() => api.get(`/healthcare/prescriptions/${encodeURIComponent(id)}`), prescriptionSerializer);
