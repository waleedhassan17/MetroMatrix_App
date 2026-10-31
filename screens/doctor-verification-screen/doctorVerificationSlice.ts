// MetroMatrix — Admin doctor verification slice: doctors waiting for a PMDC
// check (or every doctor), the document viewer and the verify-with-note sheet.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchDoctorsForVerification } from '../../networks/admin/adminHealth';
import { toRejectedValue } from '../../networks/network/network';
import type { AdminDoctor } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { adminDoctorListSerializer } from '../../serializers/health/adminHealthSerializer';
import { verifyPmdc } from '../shared/taxonomyWrites';

export type VerificationFilter = 'pending' | 'all';

export interface DoctorVerificationSliceState {
  filter: VerificationFilter;
  doctors: AdminDoctor[];
  status: FormStatus;
  error: ServerError;
  /** businessId being verified (the sheet is open). */
  verifying: string | null;
  note: string;
  noteTouched: boolean;
  busy: boolean;
  viewer: { uri: string; title: string } | null;
}

const initialState: DoctorVerificationSliceState = {
  filter: 'pending',
  doctors: [],
  status: 'idle',
  error: NO_ERROR,
  verifying: null,
  note: '',
  noteTouched: false,
  busy: false,
  viewer: null,
};

export const doctorVerificationSlice = createAppSlice({
  name: 'doctorVerification',
  initialState,
  reducers: create => ({
    setVerificationFilter: create.reducer((state, action: PayloadAction<VerificationFilter>) => {
      state.filter = action.payload;
    }),
    openVerify: create.reducer((state, action: PayloadAction<string | null>) => {
      state.verifying = action.payload;
      state.note = '';
      state.noteTouched = false;
      state.error = NO_ERROR;
    }),
    setVerifyNote: create.reducer((state, action: PayloadAction<string>) => {
      state.note = action.payload.slice(0, 300);
    }),
    touchVerifyNote: create.reducer(state => {
      state.noteTouched = true;
    }),
    openDocument: create.reducer((state, action: PayloadAction<{ uri: string; title: string } | null>) => {
      state.viewer = action.payload;
    }),
    loadDoctorsForVerificationAsync: create.asyncThunk(
      async (filter: VerificationFilter, { rejectWithValue }) => {
        try {
          return await fetchDoctorsForVerification(filter);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = adminDoctorListSerializer(action.payload);
          state.status = 'succeeded';
          state.doctors = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't load the doctors.");
        },
      },
    ),
    verifyPmdcAsync: create.asyncThunk(
      async ({ businessId, note }: { businessId: string; note: string }, { rejectWithValue }) => {
        try {
          return await verifyPmdc(businessId, note.trim());
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = false;
          state.verifying = null;
          const d = action.payload;
          state.doctors = state.doctors.map(x => (x.businessId === d.businessId ? d : x));
        },
        rejected: (state, action) => {
          state.busy = false;
          state.error = readRejection(action, "That didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectDoctorVerification: state => state,
  },
});

export const {
  setVerificationFilter,
  openVerify,
  setVerifyNote,
  touchVerifyNote,
  openDocument,
  loadDoctorsForVerificationAsync,
  verifyPmdcAsync,
} = doctorVerificationSlice.actions;
export const { selectDoctorVerification } = doctorVerificationSlice.selectors;
