// MetroMatrix — The doctor's own patients (only visits with this doctor).
// TODO(API_HEALTH): paths and shapes from docs/API_HEALTH_ASSUMED.md.

import { api } from '../../network/apiHelpers';
import { patientHistorySerializer, patientRowSerializer } from '../../../serializers/health/doctorSerializer';
import { paged } from '../../../serializers/shopping/common';
import { clean, pageParams, request } from '../../shopping/http';

export const listPatients = (q: string, page: number, pageSize = 20) =>
  request(() => api.get('/healthcare/doctor/patients', { params: clean({ q, ...pageParams(page, pageSize) }) }), raw =>
    paged(raw, patientRowSerializer),
  );

export const getPatientHistory = (id: string) =>
  request(() => api.get(`/healthcare/doctor/patients/${encodeURIComponent(id)}/history`), patientHistorySerializer);
