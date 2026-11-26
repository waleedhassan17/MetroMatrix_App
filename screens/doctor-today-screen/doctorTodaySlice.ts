// ═══════════════════════════════════════════════════════
// MetroMatrix — Today (the doctor's queue)
// ═══════════════════════════════════════════════════════
// The day's visits in time order, filtered by location, and the queue moves:
// check in → start → complete ("Payment collected?" for pay-at-visit, then
// "Write the prescription now?"). Every move answers with the appointment;
// the queue then reloads quietly.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { type DoctorAction } from '../../networks/health/doctor/doctorAppointments';
import { errorCopy, toRejectedValue } from '../../networks/network/network';
import type { TodaySummary } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { actOnAppointment, completeAppointment, getToday } from '../shared/practiceReads';

export interface DoctorTodaySliceState {
  today: TodaySummary | null;
  locationId: string | null;
  status: FormStatus;
  busy: string | null;
  /** The completion sheet: which visit, which question, and which answer is on the wire. */
  complete: { id: string | null; step: 'payment' | 'prescription'; payAtVisit: boolean; answering: 'paid' | 'not_paid' | null };
  /** Loading the day failed (shown at the top, cleared by the next good read). */
  error: ServerError;
  /** A quiet refresh failed: the queue on screen may be out of date. */
  stale: boolean;
  /** A row's own move failed (shown on that row). */
  rowError: { id: string; message: string } | null;
  /** Completing failed (shown in the sheet). */
  completeError: string | null;
}

const initialState: DoctorTodaySliceState = {
  today: null,
  locationId: null,
  status: 'idle',
  busy: null,
  complete: { id: null, step: 'payment', payAtVisit: false, answering: null },
  error: NO_ERROR,
  stale: false,
  rowError: null,
  completeError: null,
};

export const doctorTodaySlice = createAppSlice({
  name: 'doctorToday',
  initialState,
  reducers: create => ({
    setTodayLocation: create.reducer((state, action: PayloadAction<string | null>) => {
      state.locationId = action.payload;
    }),
    openComplete: create.reducer((state, action: PayloadAction<{ id: string; payAtVisit: boolean }>) => {
      state.complete = {
        id: action.payload.id,
        step: action.payload.payAtVisit ? 'payment' : 'prescription',
        payAtVisit: action.payload.payAtVisit,
        answering: null,
      };
      state.completeError = null;
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
          state.error = NO_ERROR;
          state.stale = false;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          if (action.meta.arg.quiet) state.stale = true;
          else state.error = readRejection(action, "Today's queue didn't load.");
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
          state.rowError = null;
        },
        fulfilled: state => {
          state.busy = null;
        },
        rejected: (state, action) => {
          state.busy = null;
          const error = readRejection(action, "That didn't go through. Pull down to refresh, then try again.");
          state.rowError = { id: action.meta.arg.id, message: errorCopy(error.code, error.details) ?? error.message };
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
          state.complete.answering = action.meta.arg.paymentCollected ? 'paid' : 'not_paid';
          state.completeError = null;
        },
        fulfilled: state => {
          state.busy = null;
          state.complete.answering = null;
          state.complete.step = 'prescription';
        },
        rejected: (state, action) => {
          state.busy = null;
          state.complete.answering = null;
          const error = readRejection(action, "The visit wasn't completed. Try again.");
          state.completeError = errorCopy(error.code, error.details) ?? error.message;
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
