// MetroMatrix — A patient's history with you (by patient id).

import { createAppSlice } from '@store/createAppSlice';
import { getPatientHistory } from '@networks/health/doctor/patientsNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { PatientHistory } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export interface PatientHistoryEntry {
  history: PatientHistory | null;
  status: FormStatus;
  error: ServerError;
}

export interface PatientHistorySliceState {
  byId: Record<string, PatientHistoryEntry>;
}

const EMPTY: PatientHistoryEntry = { history: null, status: 'idle', error: NO_ERROR };
const initialState: PatientHistorySliceState = { byId: {} };

export const patientHistorySlice = createAppSlice({
  name: 'patientHistory',
  initialState,
  reducers: create => ({
    loadPatientHistoryAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return await getPatientHistory(id);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const e = (state.byId[action.meta.arg] ??= { ...EMPTY });
          e.status = 'loading';
        },
        fulfilled: (state, action) => {
          state.byId[action.meta.arg] = { history: action.payload, status: 'succeeded', error: NO_ERROR };
        },
        rejected: (state, action) => {
          const e = (state.byId[action.meta.arg] ??= { ...EMPTY });
          e.status = 'failed';
          e.error = readRejection(action, "The history didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectPatientHistory: (state, id: string): PatientHistoryEntry => state.byId[id] ?? EMPTY,
  },
});

export const { loadPatientHistoryAsync } = patientHistorySlice.actions;
export const { selectPatientHistory } = patientHistorySlice.selectors;
