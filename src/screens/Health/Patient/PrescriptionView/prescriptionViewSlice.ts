// MetroMatrix — One prescription (by id), and sharing it as a PDF.

import { createAppSlice } from '@store/createAppSlice';
import { getPrescriptionAPI } from '@networks/health/prescriptionsNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { Prescription } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { prescriptionSerializer } from '@serializers/health/recordsSerializer';

export interface PrescriptionEntry {
  prescription: Prescription | null;
  status: FormStatus;
  error: ServerError;
}

export interface PrescriptionViewSliceState {
  byId: Record<string, PrescriptionEntry>;
}

const EMPTY: PrescriptionEntry = { prescription: null, status: 'idle', error: NO_ERROR };
const initialState: PrescriptionViewSliceState = { byId: {} };

export const prescriptionViewSlice = createAppSlice({
  name: 'prescriptionView',
  initialState,
  reducers: create => ({
    loadPrescriptionAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return required(prescriptionSerializer(await getPrescriptionAPI(id)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const e = (state.byId[action.meta.arg] ??= { ...EMPTY });
          e.status = 'loading';
          e.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.byId[action.meta.arg] = { prescription: action.payload, status: 'succeeded', error: NO_ERROR };
        },
        rejected: (state, action) => {
          const e = (state.byId[action.meta.arg] ??= { ...EMPTY });
          e.status = 'failed';
          e.error = readRejection(action, "The prescription didn't open.");
        },
      },
    ),
  }),
  selectors: {
    selectPrescriptionEntry: (state, id: string): PrescriptionEntry => state.byId[id] ?? EMPTY,
  },
});

export const { loadPrescriptionAsync } = prescriptionViewSlice.actions;
export const { selectPrescriptionEntry } = prescriptionViewSlice.selectors;
