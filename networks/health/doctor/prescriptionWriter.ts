// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Doctor Prescription Writer Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// Suggestions, save, edit (24 h after completion).
// MetroMatrix-API docs/API_HEALTH.md §4.3: one route writes or replaces an
// appointment's prescription.

import { API, toApiError, clean } from '../../network/network';
import type { PrescriptionInput } from '../../../models/health';

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
export const suggestMedicines = async (q: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/health/doctor/medicines/suggest', params: clean({ q }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const recentDiagnoses = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/health/doctor/diagnoses/recent' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** `appointmentId` is the appointment's code (the doctor side's id). */
export const issuePrescription = async (appointmentId: string, input: PrescriptionInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/health/doctor/appointments/${enc(appointmentId)}/prescription`, data: body(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** `409 PRESCRIPTION_LOCKED` once the 24-hour edit window has passed. */
/** A prescription the doctor wrote: editing re-issues it on its appointment (`appointmentCode`). */
export const fetchDoctorPrescription = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/health/doctor/prescriptions/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
