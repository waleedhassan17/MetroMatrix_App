// MetroMatrix — Writing prescriptions: suggestions, save, edit (24 h).
// TODO(API_HEALTH): paths and shapes from docs/API_HEALTH_ASSUMED.md.

import { api } from '../../network/apiHelpers';
import { medicineSuggestionsSerializer } from '../../../serializers/health/doctorSerializer';
import { prescriptionSerializer } from '../../../serializers/health/recordsSerializer';
import { strings } from '../../../serializers/health/healthCommon';
import type { PrescriptionInput } from '../../../types/health';
import { clean, request } from '../../shopping/http';

/** Favourites first, then the formulary. */
export const suggestMedicines = (q: string) =>
  request(() => api.get('/healthcare/doctor/medicines/suggest', { params: clean({ q }) }), medicineSuggestionsSerializer);

export const recentDiagnoses = () => request(() => api.get('/healthcare/doctor/diagnoses/recent'), strings);

export const issuePrescription = (appointmentId: string, input: PrescriptionInput) =>
  request(() => api.post(`/healthcare/doctor/appointments/${encodeURIComponent(appointmentId)}/prescription`, input), prescriptionSerializer);

/** `409 PRESCRIPTION_LOCKED` once the 24-hour edit window has passed. */
export const updatePrescription = (id: string, input: PrescriptionInput) =>
  request(() => api.patch(`/healthcare/doctor/prescriptions/${encodeURIComponent(id)}`, input), prescriptionSerializer);
