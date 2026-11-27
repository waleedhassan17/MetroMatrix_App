// ═══════════════════════════════════════════════════════
// MetroMatrix — Hours for one day (extra, shorter, or closed)
// ═══════════════════════════════════════════════════════
// A date's own hours at a location replace its weekly hours there
// (PUT /health/doctor/locations/:id/overrides/:date). Saving checks first
// (?dryRun=true): booked visits the new hours leave out are listed, and stay
// booked; the doctor confirms, then it saves. The calendar shows each day's
// own hours from `byLocation`.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchDayHours, fetchLocationSchedule, removeDayHours, saveDayHours } from '../../networks/health/doctor/practice';
import { errorCopy, toRejectedValue } from '../../networks/network/network';
import { dayHoursListSerializer, hoursReportSerializer, hoursSerializer } from '../../serializers/health/doctorSerializer';
import { bodyOf } from '../../serializers/serializerUtils';
import { isoWeekday } from '../../utils/health-time/healthTime';
import { DEFAULT_RANGE } from '../../models/health/availabilityModel';
import type { DayHours, HoursReport, TimeRange, WeekDayHours } from '../../models/health';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';

export interface DayHoursSheetState {
  open: boolean;
  locations: { id: string; name: string; slotMinutes: number }[];
  locationId: string | null;
  date: string | null;
  closed: boolean;
  ranges: TimeRange[];
  note: string;
  /** The day had its own hours already (it can go back to the usual ones). */
  existing: boolean;
  touched: boolean;
  status: FormStatus;
  error: ServerError;
  /** The check before saving: visits left outside, hours shared. */
  check: HoursReport | null;
  /** Each location's own hours by date, for the calendar. */
  byLocation: Record<string, DayHours[]>;
  /** Each location's usual week, so a day without its own hours starts from them. */
  usual: Record<string, WeekDayHours[]>;
  /** Saved or removed: the calendar reloads. */
  saved: number;
}

const initialState: DayHoursSheetState = {
  open: false,
  locations: [],
  locationId: null,
  date: null,
  closed: false,
  ranges: [],
  note: '',
  existing: false,
  touched: false,
  status: 'idle',
  error: NO_ERROR,
  check: null,
  byLocation: {},
  usual: {},
  saved: 0,
};

const fill = (state: DayHoursSheetState) => {
  const own = state.locationId && state.date ? (state.byLocation[state.locationId] ?? []).find(d => d.date === state.date) : undefined;
  // No hours of its own: start from that weekday's usual hours.
  const usual = state.locationId && state.date ? (state.usual[state.locationId] ?? []).find(d => d.day === isoWeekday(state.date!))?.ranges : undefined;
  state.existing = !!own;
  state.closed = own?.closed ?? false;
  state.ranges = own ? own.ranges.map(r => ({ ...r })) : usual?.length ? usual.map(r => ({ ...r })) : [{ ...DEFAULT_RANGE }];
  state.note = own?.note ?? '';
  state.check = null;
  state.touched = false;
  state.error = NO_ERROR;
};

export const dayHoursSlice = createAppSlice({
  name: 'dayHours',
  initialState,
  reducers: create => ({
    openDayHours: create.reducer(
      (state, action: PayloadAction<{ date: string; locations: { id: string; name: string; slotMinutes: number }[]; locationId?: string | null; closed?: boolean }>) => {
        state.open = true;
        state.date = action.payload.date;
        state.locations = action.payload.locations;
        state.locationId = action.payload.locationId ?? action.payload.locations[0]?.id ?? null;
        state.status = 'idle';
        fill(state);
        if (action.payload.closed) state.closed = true;
      },
    ),
    closeDayHours: create.reducer(state => {
      state.open = false;
      state.check = null;
    }),
    chooseDayHoursPlace: create.reducer((state, action: PayloadAction<string>) => {
      state.locationId = action.payload;
      fill(state);
    }),
    setDayClosed: create.reducer((state, action: PayloadAction<boolean>) => {
      state.closed = action.payload;
      state.check = null;
      if (!action.payload && !state.ranges.length) state.ranges = [{ ...DEFAULT_RANGE }];
    }),
    setDayRange: create.reducer((state, action: PayloadAction<{ index: number; field: 'from' | 'to'; value: string }>) => {
      const r = state.ranges[action.payload.index];
      if (r) r[action.payload.field] = action.payload.value;
      state.check = null;
    }),
    addDayRange: create.reducer(state => {
      const last = state.ranges[state.ranges.length - 1];
      state.ranges.push(last ? { from: last.to, to: last.to < '22:00' ? '22:00' : '23:59' } : { ...DEFAULT_RANGE });
      state.check = null;
    }),
    removeDayRange: create.reducer((state, action: PayloadAction<number>) => {
      state.ranges.splice(action.payload, 1);
      state.check = null;
    }),
    setDayNote: create.reducer((state, action: PayloadAction<string>) => {
      state.note = action.payload;
    }),
    touchDayHours: create.reducer(state => {
      state.touched = true;
    }),

    /** The locations' usual weeks (once per open): a day without its own hours starts from them. */
    loadUsualHoursAsync: create.asyncThunk(
      async (locationIds: string[]) => {
        const weeks = await Promise.all(locationIds.map(id => fetchLocationSchedule(id).catch(() => null)));
        return Object.fromEntries(locationIds.map((id, i) => [id, weeks[i]]));
      },
      {
        fulfilled: (state, action) => {
          for (const [id, raw] of Object.entries(action.payload)) if (raw) state.usual[id] = hoursSerializer(bodyOf(raw));
          // Still untouched and without its own hours: show the usual ones.
          if (state.open && !state.touched && !state.existing && !state.closed) fill(state);
        },
      },
    ),
    /** Every location's own hours between two dates (the calendar's range). */
    loadDayHoursAsync: create.asyncThunk(
      async ({ locationIds, from, to }: { locationIds: string[]; from: string; to: string }, { rejectWithValue }) => {
        try {
          const lists = await Promise.all(locationIds.map(id => fetchDayHours(id, from, to)));
          return Object.fromEntries(locationIds.map((id, i) => [id, lists[i]]));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          for (const [id, raw] of Object.entries(action.payload)) state.byLocation[id] = dayHoursListSerializer(raw);
        },
      },
    ),
    /** `dryRun` checks (visits left outside, hours shared); otherwise saves. */
    saveDayHoursAsync: create.asyncThunk(
      async ({ locationId, input, dryRun }: { locationId: string; input: DayHours; dryRun: boolean }, { rejectWithValue }) => {
        try {
          return await saveDayHours(locationId, input, dryRun);
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
          state.status = 'succeeded';
          const report = hoursReportSerializer(action.payload);
          if (action.meta.arg.dryRun) {
            state.check = report ?? { sharedWith: [], outsideHours: [], slots: null };
            return;
          }
          const { locationId, input } = action.meta.arg;
          state.byLocation[locationId] = [...(state.byLocation[locationId] ?? []).filter(d => d.date !== input.date), input].sort((a, b) =>
            a.date.localeCompare(b.date),
          );
          state.open = false;
          state.check = null;
          state.saved += 1;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          const error = readRejection(action, "Those hours didn't save. Try again.");
          state.error = { ...error, message: errorCopy(error.code, error.details) ?? error.message };
          state.check = null;
        },
      },
    ),
    removeDayHoursAsync: create.asyncThunk(
      async ({ locationId, date }: { locationId: string; date: string }, { rejectWithValue }) => {
        try {
          return await removeDayHours(locationId, date);
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
          state.status = 'succeeded';
          const { locationId, date } = action.meta.arg;
          state.byLocation[locationId] = (state.byLocation[locationId] ?? []).filter(d => d.date !== date);
          state.open = false;
          state.saved += 1;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "That didn't change. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectDayHours: state => state,
  },
});

export const {
  loadUsualHoursAsync,
  openDayHours,
  closeDayHours,
  chooseDayHoursPlace,
  setDayClosed,
  setDayRange,
  addDayRange,
  removeDayRange,
  setDayNote,
  touchDayHours,
  loadDayHoursAsync,
  saveDayHoursAsync,
  removeDayHoursAsync,
} = dayHoursSlice.actions;
export const { selectDayHours } = dayHoursSlice.selectors;
