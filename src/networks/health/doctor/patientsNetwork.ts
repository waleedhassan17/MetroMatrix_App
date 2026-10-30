// MetroMatrix — The doctor's own patients (only visits with this doctor).
// MetroMatrix-API docs/API_HEALTH.md §4.3; a patient is a person (`patientKey`).

import { api } from '../../network/apiHelpers';
import { patientHistorySerializer, patientRowSerializer, patientRowPageSerializer } from '../../../serializers/health/doctorSerializer';
import { paged } from '../../../serializers/shopping/common';
import { clean, pageParams, request } from '../../shopping/http';

export const listPatients = (q: string, page: number, pageSize = 20) =>
  request(() => api.get('/health/doctor/patients', { params: clean({ q, ...pageParams(page, pageSize) }) }), patientRowPageSerializer,
  );

/** The history with this doctor only (audited). */
export const getPatientHistory = (id: string) =>
  request(() => api.get(`/health/doctor/patients/${encodeURIComponent(id)}`), patientHistorySerializer);
