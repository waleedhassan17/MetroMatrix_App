// MetroMatrix — Admin appointment lookup slice.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { lookupAppointment } from '@networks/admin/adminHealthNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { AdminAppointment } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export interface AppointmentLookupSliceState {
  code: string;
  result: AdminAppointment | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: AppointmentLookupSliceState = { code: '', result: null, status: 'idle', error: NO_ERROR };

export const appointmentLookupSlice = createAppSlice({
  name: 'appointmentLookup',
  initialState,
  reducers: create => ({
    setAppointmentLookupCode: create.reducer((state, action: PayloadAction<string>) => {
      state.code = action.payload.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
    }),
    lookupAppointmentAsync: create.asyncThunk(
      async (code: string, { rejectWithValue }) => {
        try {
          return await lookupAppointment(code);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = NO_ERROR;
          state.result = null;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.result = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, 'No appointment with that code.');
        },
      },
    ),
  }),
  selectors: {
    selectAppointmentLookup: state => state,
  },
});

export const { setAppointmentLookupCode, lookupAppointmentAsync } = appointmentLookupSlice.actions;
export const { selectAppointmentLookup } = appointmentLookupSlice.selectors;
