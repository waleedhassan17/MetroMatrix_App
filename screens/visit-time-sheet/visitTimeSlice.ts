// ═══════════════════════════════════════════════════════
// MetroMatrix — Pick one of your own times: move a visit, or book a follow-up
// ═══════════════════════════════════════════════════════
// The doctor's own free slots at a location (GET /health/doctor/locations/:id/
// slots: no notice, bookings on or paused, up to 120 days ahead), a month at a
// time. Moving needs a reason (the patient is told it) and keeps the kind of
// visit; a follow-up may be at any location. A time taken meanwhile reloads
// the days and says so.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchDoctorLocations, fetchOwnSlots } from '../../networks/health/doctor/practice';
import { bookFollowUp, moveAppointment } from '../../networks/health/doctor/doctorAppointments';
import { errorCopy, toRejectedValue } from '../../networks/network/network';
import { daysSerializer, slotDayOnSerializer } from '../../serializers/health/discoverySerializer';
import { createdAppointmentSerializer, placesSerializer } from '../../serializers/health/doctorSerializer';
import type { ConsultKind, DayAvailability, SlotDay } from '../../models/health';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';

export type VisitTimeMode = 'move' | 'follow_up';

/** A month of days per read. */
export const VISIT_TIME_DAYS = 30;

export interface VisitTimeLocation {
  id: string;
  name: string;
  kind: ConsultKind;
}

export interface VisitTimeSheetState {
  open: boolean;
  mode: VisitTimeMode;
  /** The visit being moved or followed up (its code). */
  appointmentId: string | null;
  locations: VisitTimeLocation[];
  locationId: string | null;
  /** Where the visit is now (a move elsewhere names the new place). */
  originalLocationId: string | null;
  /** The first date read (the month shown starts here). */
  from: string | null;
  days: DayAvailability[];
  day: SlotDay | null;
  date: string | null;
  selected: string | null;
  reason: string;
  touched: boolean;
  loading: boolean;
  status: FormStatus;
  error: ServerError;
  /** The new visit's code, once made. */
  done: string | null;
  /** The days as read, kept to show another of them without a request. */
  raw: unknown;
}

const initialState: VisitTimeSheetState = {
  open: false,
  mode: 'move',
  appointmentId: null,
  locations: [],
  locationId: null,
  originalLocationId: null,
  from: null,
  days: [],
  day: null,
  date: null,
  selected: null,
  reason: '',
  touched: false,
  loading: false,
  status: 'idle',
  error: NO_ERROR,
  done: null,
  raw: null,
};

/** The moving reason the patient reads (the API's 3–500). */
export const MAX_MOVE_REASON = 500;
export const validateMoveReason = (reason: string) =>
  reason.trim().length < 3 ? 'Tell the patient why, in a few words' : reason.length > MAX_MOVE_REASON ? `Keep it under ${MAX_MOVE_REASON} characters` : undefined;

export const visitTimeSlice = createAppSlice({
  name: 'visitTime',
  initialState,
  reducers: create => ({
    openVisitTime: create.reducer(
      (state, action: PayloadAction<{ mode: VisitTimeMode; appointmentId: string; location: VisitTimeLocation; from: string | null }>) => ({
        ...initialState,
        open: true,
        mode: action.payload.mode,
        appointmentId: action.payload.appointmentId,
        locations: [action.payload.location],
        locationId: action.payload.location.id,
        originalLocationId: action.payload.location.id,
        from: action.payload.from,
      }),
    ),
    touchVisitTime: create.reducer(state => {
      state.touched = true;
    }),
    closeVisitTime: create.reducer(state => {
      state.open = false;
    }),
    pickVisitTime: create.reducer((state, action: PayloadAction<string>) => {
      state.selected = action.payload;
    }),
    /** Another day of the month already read. */
    showVisitDay: create.reducer((state, action: PayloadAction<string>) => {
      state.date = action.payload;
      state.selected = null;
      state.day = slotDayOnSerializer(state.raw, action.payload);
    }),
    setMoveReason: create.reducer((state, action: PayloadAction<string>) => {
      state.reason = action.payload;
    }),
    clearVisitTimeDone: create.reducer(state => {
      state.done = null;
    }),

    /** Where it can be: a move keeps the kind of visit; a follow-up may be anywhere. */
    loadVisitPlacesAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await fetchDoctorLocations();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          const places = placesSerializer(action.payload);
          const here = state.locations.find(l => l.id === state.originalLocationId);
          const fit = state.mode === 'move' && here ? places.filter(p => p.kind === here.kind) : places;
          // The current place first.
          if (fit.length) state.locations = [...fit.filter(p => p.id === state.originalLocationId), ...fit.filter(p => p.id !== state.originalLocationId)];
        },
      },
    ),
    loadVisitDaysAsync: create.asyncThunk(
      async ({ locationId, from }: { locationId: string; from: string | null }, { rejectWithValue }) => {
        try {
          return await fetchOwnSlots(locationId, from, VISIT_TIME_DAYS);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.loading = true;
          state.locationId = action.meta.arg.locationId;
          state.from = action.meta.arg.from;
          state.selected = null;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.loading = false;
          state.raw = action.payload;
          state.days = daysSerializer(action.payload);
          // The first day with room, else the first.
          const pick = state.days.find(d => d.slotCount > 0)?.date ?? state.days[0]?.date ?? null;
          state.date = pick;
          state.day = pick ? slotDayOnSerializer(action.payload, pick) : null;
        },
        rejected: (state, action) => {
          state.loading = false;
          state.error = readRejection(action, "Your times didn't load.");
        },
      },
    ),
    saveVisitTimeAsync: create.asyncThunk(
      async (
        arg: { mode: VisitTimeMode; appointmentId: string; locationId: string; startAt: string; reason: string; sameLocation: boolean },
        { rejectWithValue },
      ) => {
        try {
          return arg.mode === 'move'
            ? await moveAppointment(arg.appointmentId, { startAt: arg.startAt, locationId: arg.sameLocation ? null : arg.locationId, reason: arg.reason.trim() })
            : await bookFollowUp(arg.appointmentId, { locationId: arg.locationId, startAt: arg.startAt });
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.touched = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          const made = createdAppointmentSerializer(action.payload);
          if (!made) return;
          state.done = made.code;
          state.open = false;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          const error = readRejection(action, "That didn't save. Try again.");
          state.error = { ...error, message: errorCopy(error.code, error.details) ?? error.message };
          // Taken meanwhile: that time is gone from the grid.
          if (error.code === 'SLOT_TAKEN') state.selected = null;
        },
      },
    ),
  }),
  selectors: {
    selectVisitTime: state => state,
  },
});

export const {
  openVisitTime,
  closeVisitTime,
  touchVisitTime,
  pickVisitTime,
  showVisitDay,
  setMoveReason,
  clearVisitTimeDone,
  loadVisitDaysAsync,
  loadVisitPlacesAsync,
  saveVisitTimeAsync,
} = visitTimeSlice.actions;
export const { selectVisitTime } = visitTimeSlice.selectors;
