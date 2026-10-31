// ═══════════════════════════════════════════════════════
// MetroMatrix — Time off
// ═══════════════════════════════════════════════════════
// Days you won't see patients, at every location or one. Over booked visits
// the API answers with them first (TIME_OFF_CONFLICTS); confirming cancels
// them and tells each patient.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { removeTimeOffAPI } from '../../networks/health/doctor/practiceNetwork';
import { toRejectedValue } from '../../networks/network/apiHelpers';
import { conflictsFrom } from '../../serializers/health/doctorSerializer';
import type { ConflictingAppointment, TimeOff, TimeOffInput } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { addTimeOff, listLocations, listTimeOff } from '../shared/practiceReads';

export interface TimeOffSliceState {
  items: TimeOff[];
  locations: { id: string; name: string }[];
  status: FormStatus;
  sheetOpen: boolean;
  form: TimeOffInput;
  touched: boolean;
  conflicts: ConflictingAppointment[];
  busy: 'add' | 'remove' | null;
  error: ServerError;
}

const blank = (date = ''): TimeOffInput => ({ from: date, to: date, locationId: null, reason: null });

const initialState: TimeOffSliceState = {
  items: [],
  locations: [],
  status: 'idle',
  sheetOpen: false,
  form: blank(),
  touched: false,
  conflicts: [],
  busy: null,
  error: NO_ERROR,
};

export const timeOffSlice = createAppSlice({
  name: 'timeOff',
  initialState,
  reducers: create => ({
    openTimeOffSheet: create.reducer((state, action: PayloadAction<string | undefined>) => {
      state.sheetOpen = true;
      state.form = blank(action.payload ?? '');
      state.touched = false;
      state.conflicts = [];
      state.error = NO_ERROR;
    }),
    closeTimeOffSheet: create.reducer(state => {
      state.sheetOpen = false;
      state.conflicts = [];
    }),
    editTimeOff: create.reducer((state, action: PayloadAction<Partial<TimeOffInput>>) => {
      state.form = { ...state.form, ...action.payload };
      state.conflicts = [];
    }),
    touchTimeOff: create.reducer(state => {
      state.touched = true;
    }),
    loadTimeOffAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          const [items, locations] = await Promise.all([listTimeOff(), listLocations()]);
          return { items, locations: locations.map(l => ({ id: l.id, name: l.name })) };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.items = action.payload.items;
          state.locations = action.payload.locations;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your time off didn't load.");
        },
      },
    ),
    addTimeOffAsync: create.asyncThunk(
      async ({ input, cancelConflicts }: { input: TimeOffInput; cancelConflicts: boolean }, { rejectWithValue }) => {
        try {
          return await addTimeOff(input, cancelConflicts);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = 'add';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = null;
          state.sheetOpen = false;
          state.conflicts = [];
          state.items = [...state.items, action.payload].sort((a, b) => a.from.localeCompare(b.from));
        },
        rejected: (state, action) => {
          state.busy = null;
          const e = readRejection(action, "The time off wasn't saved.");
          if (e.code === 'TIME_OFF_CONFLICTS') state.conflicts = conflictsFrom(e.details);
          else state.error = e;
        },
      },
    ),
    removeTimeOffAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          await removeTimeOffAPI(id);
          return id;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = 'remove';
        },
        fulfilled: (state, action) => {
          state.busy = null;
          state.items = state.items.filter(t => t.id !== action.payload);
        },
        rejected: (state, action) => {
          state.busy = null;
          state.error = readRejection(action, "It wasn't removed.");
        },
      },
    ),
  }),
  selectors: {
    selectTimeOff: state => state,
  },
});

export const { openTimeOffSheet, closeTimeOffSheet, editTimeOff, touchTimeOff, loadTimeOffAsync, addTimeOffAsync, removeTimeOffAsync } = timeOffSlice.actions;
export const { selectTimeOff } = timeOffSlice.selectors;
