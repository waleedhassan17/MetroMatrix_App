// MetroMatrix — Writing prescriptions: suggestions, save, edit (24 h after completion).
// MetroMatrix-API docs/API_HEALTH.md §4.3: one route writes or replaces an
// appointment's prescription.

import { api, unwrap } from '../../network/apiHelpers';
import { medicineSuggestionsSerializer } from '../../../serializers/health/doctorSerializer';
import { prescriptionSerializer } from '../../../serializers/health/recordsSerializer';
import { strings } from '../../../serializers/health/healthCommon';
import { isObject, str } from '../../../serializers/serializerUtils';
import type { PrescriptionInput } from '../../../types/health';
import { clean, request } from '../../shopping/http';

const enc = encodeURIComponent;

const body = (input: PrescriptionInput) => ({
  diagnosis: input.diagnosis,
  advice: input.advice ?? undefined,
  followUpInDays: input.followUpInDays ?? undefined,
  medicines: input.medicines.map(m => ({
    name: m.name,
    strength: m.strength || undefined,
    form: m.form,
    dosePattern: m.dose,
    timing: m.timing ?? undefined,
    durationDays: m.days,
    instructions: m.instructions ?? undefined,
  })),
  tests: input.tests.map(name => ({ name })),
});

/** Favourites (with their usual dose) first, then the reference list. */
export const suggestMedicines = (q: string) =>
  request(() => api.get('/health/doctor/medicines/suggest', { params: clean({ q }) }), medicineSuggestionsSerializer);

export const recentDiagnoses = () => request(() => api.get('/health/doctor/diagnoses/recent'), strings);

/** `appointmentId` is the appointment's code (the doctor side's id). */
export const issuePrescription = (appointmentId: string, input: PrescriptionInput) =>
  request(() => api.post(`/health/doctor/appointments/${enc(appointmentId)}/prescription`, body(input)), prescriptionSerializer);

/** `409 PRESCRIPTION_LOCKED` once the 24-hour edit window has passed. */
export const updatePrescription = (id: string, input: PrescriptionInput) =>
  request(async () => {
    const current = unwrap(await api.get(`/health/doctor/prescriptions/${enc(id)}`));
    const code = isObject(current) ? str(current.appointmentCode) : '';
    return api.post(`/health/doctor/appointments/${enc(code)}/prescription`, body(input));
  }, prescriptionSerializer);
