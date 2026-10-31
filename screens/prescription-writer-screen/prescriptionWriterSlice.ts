// ═══════════════════════════════════════════════════════
// MetroMatrix — Write (or edit) a prescription
// ═══════════════════════════════════════════════════════
// Opens on the appointment (patient, any prescription already written), your
// recent diagnoses and your profile (for the document's header). Medicine
// names suggest as you type, favourites first. Saving sends it to the patient;
// it can be changed for 24 hours, then it locks.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';

import { issuePrescriptionAPI, recentDiagnosesAPI, suggestMedicinesAPI } from '../../networks/health/doctor/prescriptionWriterNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import { emptyMedicine, emptyPrescription, moveMedicine } from '../../models/health/prescriptionModel';
import type { DoctorAppointmentDetail, DoctorOwnProfile, Medicine, MedicineSuggestion, PrescriptionInput } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { recentDiagnosesSerializer, medicineSuggestionsSerializer } from '../../serializers/health/doctorSerializer';
import { prescriptionSerializer } from '../../serializers/health/recordsSerializer';
import { getDoctorAppointment, getOwnProfile, updatePrescription } from '../shared/practiceReads';

export interface PrescriptionWriterSliceState {
  appointment: DoctorAppointmentDetail | null;
  profile: DoctorOwnProfile | null;
  prescriptionId: string | null;
  editableUntil: string | null;
  form: PrescriptionInput;
  diagnoses: string[];
  suggestions: { row: number; items: MedicineSuggestion[] } | null;
  newTest: string;
  preview: boolean;
  touched: boolean;
  status: FormStatus;
  saveStatus: FormStatus;
  error: ServerError;
}

const initialState: PrescriptionWriterSliceState = {
  appointment: null,
  profile: null,
  prescriptionId: null,
  editableUntil: null,
  form: emptyPrescription(),
  diagnoses: [],
  suggestions: null,
  newTest: '',
  preview: false,
  touched: false,
  status: 'idle',
  saveStatus: 'idle',
  error: NO_ERROR,
};

export const prescriptionWriterSlice = createAppSlice({
  name: 'prescriptionWriter',
  initialState,
  reducers: create => ({
    setDiagnosis: create.reducer((state, action: PayloadAction<string>) => {
      state.form.diagnosis = action.payload;
    }),
    setMedicine: create.reducer((state, action: PayloadAction<{ index: number; patch: Partial<Medicine> }>) => {
      const m = state.form.medicines[action.payload.index];
      if (m) state.form.medicines[action.payload.index] = { ...m, ...action.payload.patch };
    }),
    addMedicine: create.reducer(state => {
      state.form.medicines.push(emptyMedicine());
    }),
    removeMedicine: create.reducer((state, action: PayloadAction<number>) => {
      state.form.medicines.splice(action.payload, 1);
      if (!state.form.medicines.length) state.form.medicines.push(emptyMedicine());
      state.suggestions = null;
    }),
    moveMedicineRow: create.reducer((state, action: PayloadAction<{ from: number; to: number }>) => {
      state.form.medicines = moveMedicine(state.form.medicines, action.payload.from, action.payload.to);
      state.suggestions = null;
    }),
    pickSuggestion: create.reducer((state, action: PayloadAction<{ index: number; s: MedicineSuggestion }>) => {
      const m = state.form.medicines[action.payload.index];
      if (m) state.form.medicines[action.payload.index] = { ...m, name: action.payload.s.name, strength: action.payload.s.strength, form: action.payload.s.form };
      state.suggestions = null;
    }),
    clearSuggestions: create.reducer(state => {
      state.suggestions = null;
    }),
    setNewTest: create.reducer((state, action: PayloadAction<string>) => {
      state.newTest = action.payload;
    }),
    addTest: create.reducer(state => {
      const t = state.newTest.trim();
      if (t && !state.form.tests.includes(t)) state.form.tests.push(t);
      state.newTest = '';
    }),
    removeTest: create.reducer((state, action: PayloadAction<string>) => {
      state.form.tests = state.form.tests.filter(t => t !== action.payload);
    }),
    setAdvice: create.reducer((state, action: PayloadAction<string>) => {
      state.form.advice = action.payload || null;
    }),
    setFollowUp: create.reducer((state, action: PayloadAction<number | null>) => {
      state.form.followUpInDays = action.payload;
    }),
    setPreview: create.reducer((state, action: PayloadAction<boolean>) => {
      state.preview = action.payload;
    }),
    touchPrescription: create.reducer(state => {
      state.touched = true;
    }),

    startWriterAsync: create.asyncThunk(
      async (appointmentId: string, { rejectWithValue }) => {
        try {
          const [appointment, diagnoses, profile] = await Promise.all([getDoctorAppointment(appointmentId), recentDiagnosesAPI().then(raw => required(recentDiagnosesSerializer(raw))), getOwnProfile()]);
          return { appointment, diagnoses, profile };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => ({ ...initialState, status: 'loading' as FormStatus, diagnoses: state.diagnoses }),
        fulfilled: (state, action) => {
          const { appointment, diagnoses, profile } = action.payload;
          const rx = appointment.prescription;
          state.status = 'succeeded';
          state.appointment = appointment;
          state.profile = profile;
          state.diagnoses = diagnoses;
          state.prescriptionId = rx?.id ?? null;
          state.editableUntil = rx?.editableUntil ?? null;
          state.form = rx
            ? { diagnosis: rx.diagnosis, medicines: rx.medicines.length ? rx.medicines : [emptyMedicine()], tests: rx.tests, advice: rx.advice, followUpInDays: rx.followUpInDays }
            : emptyPrescription();
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The appointment didn't open.");
        },
      },
    ),
    suggestMedicineAsync: create.asyncThunk(
      async ({ q }: { row: number; q: string }, { rejectWithValue }) => {
        try {
          return required(medicineSuggestionsSerializer(await suggestMedicinesAPI(q)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          const m = state.form.medicines[action.meta.arg.row];
          // Only for what is still in that box.
          if (m && m.name.trim() === action.meta.arg.q) state.suggestions = { row: action.meta.arg.row, items: action.payload };
        },
      },
    ),
    savePrescriptionAsync: create.asyncThunk(
      async ({ appointmentId, prescriptionId, input }: { appointmentId: string; prescriptionId: string | null; input: PrescriptionInput }, { rejectWithValue }) => {
        try {
          return prescriptionId ? await updatePrescription(prescriptionId, input) : required(prescriptionSerializer(await issuePrescriptionAPI(appointmentId, input)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saveStatus = 'loading';
          state.touched = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.saveStatus = 'succeeded';
          state.prescriptionId = action.payload.id;
          state.editableUntil = action.payload.editableUntil;
        },
        rejected: (state, action) => {
          state.saveStatus = 'failed';
          state.error = readRejection(action, "The prescription wasn't saved. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectWriter: state => state,
  },
});

export const {
  setDiagnosis,
  setMedicine,
  addMedicine,
  removeMedicine,
  moveMedicineRow,
  pickSuggestion,
  clearSuggestions,
  setNewTest,
  addTest,
  removeTest,
  setAdvice,
  setFollowUp,
  setPreview,
  touchPrescription,
  startWriterAsync,
  suggestMedicineAsync,
  savePrescriptionAsync,
} = prescriptionWriterSlice.actions;
export const { selectWriter } = prescriptionWriterSlice.selectors;
