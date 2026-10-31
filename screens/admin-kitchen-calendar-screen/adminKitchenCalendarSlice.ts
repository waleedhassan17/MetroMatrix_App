// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: calendar slice
// ═══════════════════════════════════════════════════════
// The events kitchens plan around (Ramadan, Eid, others): the list, the
// sheet that adds or moves one, and deleting one.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEvents,
  updateCalendarEvent,
} from '../../networks/admin/adminKitchen';
import { toRejectedValue } from '../../networks/network/network';
import { emptyEventForm } from '../../models/kitchen/adminKitchenModel';
import type { CalendarEvent, CalendarEventInput } from '../../models';
import {
  NO_ERROR,
  readRejection,
  type FormStatus,
  type ServerError,
} from '../shared/formStatus';
import { calendarEventsSerializer } from '../../serializers/kitchen/adminKitchenSerializer';

export interface EventSheet extends CalendarEventInput {
  /** '' for a new one. */
  id: string;
}

export interface AdminKitchenCalendarSliceState {
  events: CalendarEvent[];
  status: FormStatus;
  error: ServerError;
  sheet: EventSheet | null;
  submitted: boolean;
  busy: boolean;
  saveError: ServerError;
}

const initialState: AdminKitchenCalendarSliceState = {
  events: [],
  status: 'idle',
  error: NO_ERROR,
  sheet: null,
  submitted: false,
  busy: false,
  saveError: NO_ERROR,
};

type Change = { kind: 'save'; sheet: EventSheet } | { kind: 'delete'; id: string };

export const adminKitchenCalendarSlice = createAppSlice({
  name: 'adminKitchenCalendar',
  initialState,
  reducers: create => ({
    openEventSheet: create.reducer((state, action: PayloadAction<CalendarEvent | { new: string } | null>) => {
      const e = action.payload;
      state.sheet = e === null ? null : 'new' in e ? { id: '', ...emptyEventForm(e.new) } : { id: e.id, kind: e.kind, name: e.name, startsOn: e.startsOn, endsOn: e.endsOn };
      state.submitted = false;
      state.saveError = NO_ERROR;
    }),
    setEventSheet: create.reducer((state, action: PayloadAction<Partial<CalendarEventInput>>) => {
      if (!state.sheet) return;
      const next = { ...state.sheet, ...action.payload };
      // A new first day after the last moves the last day with it.
      if (action.payload.startsOn && next.endsOn < action.payload.startsOn) next.endsOn = action.payload.startsOn;
      state.sheet = next;
    }),
    markEventSubmitted: create.reducer(state => {
      state.submitted = true;
    }),

    loadEventsAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await fetchCalendarEvents();
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
          const payload = calendarEventsSerializer(action.payload);
          state.status = 'succeeded';
          state.events = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The calendar didn't load.");
        },
      },
    ),

    changeEventAsync: create.asyncThunk(
      async (change: Change, { rejectWithValue }) => {
        try {
          if (change.kind === 'delete') await deleteCalendarEvent(change.id);
          else {
            const { id, ...input } = change.sheet;
            if (id) await updateCalendarEvent(id, input);
            else await createCalendarEvent(input);
          }
          return await fetchCalendarEvents();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = true;
          state.saveError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = calendarEventsSerializer(action.payload);
          state.busy = false;
          state.sheet = null;
          state.events = payload;
        },
        rejected: (state, action) => {
          state.busy = false;
          state.saveError = readRejection(action, "That didn't go through.");
        },
      },
    ),
  }),
  selectors: {
    selectAdminKitchenCalendar: state => state,
  },
});

export const { openEventSheet, setEventSheet, markEventSubmitted, loadEventsAsync, changeEventAsync } =
  adminKitchenCalendarSlice.actions;
export const { selectAdminKitchenCalendar } = adminKitchenCalendarSlice.selectors;
