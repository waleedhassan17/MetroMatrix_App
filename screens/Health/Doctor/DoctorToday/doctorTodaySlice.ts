// ═══════════════════════════════════════════════════════
// MetroMatrix — Today (the doctor's queue)
// ═══════════════════════════════════════════════════════
// The day's visits in time order, filtered by location, and the queue moves:
// check in → start → complete ("Payment collected?" for pay-at-visit, then
// "Write the prescription now?"). Every move answers with the appointment;
// the queue then reloads quietly.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../../store/createAppSlice';
import { type DoctorAction } from '../../../../networks/health/doctor/doctorAppointmentsNetwork';
import { toRejectedValue } from '../../../../networks/network/apiHelpers';
import type { TodaySummary } from '../../../../types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { actOnAppointment, completeAppointment, getToday } from '../shared/practiceReads';

export interface DoctorTodaySliceState {
  today: TodaySummary | null;
  locationId: string | null;
  status: FormStatus;
  busy: string | null;
  /** The completion sheet: which visit, and which question it is on. */
  complete: { id: string | null; step: 'payment' | 'prescription'; payAtVisit: boolean };
  error: ServerError;
}

const initialState: DoctorTodaySliceState = {
  today: null,
  locationId: null,
  status: 'idle',
  busy: null,
  complete: { id: null, step: 'payment', payAtVisit: false },
  error: NO_ERROR,
};

export const doctorTodaySlice = createAppSlice({
  name: 'doctorToday',
  initialState,
  reducers: create => ({
    setTodayLocation: create.reducer((state, action: PayloadAction<string | null>) => {
      state.locationId = action.payload;
    }),
    openComplete: create.reducer((state, action: PayloadAction<{ id: string; payAtVisit: boolean }>) => {
      state.complete = { id: action.payload.id, step: action.payload.payAtVisit ? 'payment' : 'prescription', payAtVisit: action.payload.payAtVisit };
      state.error = NO_ERROR;
    }),
    closeComplete: create.reducer(state => {
      state.complete.id = null;
    }),
    loadTodayAsync: create.asyncThunk(
      async ({ locationId }: { locationId: string | null; quiet?: boolean }, { rejectWithValue }) => {
        try {
          return await getToday(null, locationId);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          if (!action.meta.arg.quiet) state.status = 'loading';
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.today = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          if (!action.meta.arg.quiet) state.error = readRejection(action, "Today's queue didn't load.");
        },
      },
    ),
    queueActionAsync: create.asyncThunk(
      async ({ id, action }: { id: string; action: DoctorAction }, { rejectWithValue }) => {
        try {
          return await actOnAppointment(id, action);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busy = action.meta.arg.id;
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.busy = null;
        },
        rejected: (state, action) => {
          state.busy = null;
          state.error = readRejection(action, "That didn't go through. Pull down to refresh.");
        },
      },
    ),
    completeVisitAsync: create.asyncThunk(
      async ({ id, paymentCollected }: { id: string; paymentCollected: boolean }, { rejectWithValue }) => {
        try {
          return await completeAppointment(id, paymentCollected);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busy = action.meta.arg.id;
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.busy = null;
          state.complete.step = 'prescription';
        },
        rejected: (state, action) => {
          state.busy = null;
          state.error = readRejection(action, "The visit wasn't completed. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectDoctorToday: state => state,
  },
});

export const { setTodayLocation, openComplete, closeComplete, loadTodayAsync, queueActionAsync, completeVisitAsync } = doctorTodaySlice.actions;
export const { selectDoctorToday } = doctorTodaySlice.selectors;
