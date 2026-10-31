// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor opening hours (the whole week, replaced at once)
// ═══════════════════════════════════════════════════════
// Several ranges a day (lunch, dinner); a range that closes before it opens
// runs past midnight (18:00–02:00). Copy a day to every day, or to weekdays.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { getHoursAPI, saveHoursAPI } from '../../networks/food/vendor/settingsNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import { MAX_RANGES_PER_DAY } from '../../models/food/vendorModel';
import type { HoursRange } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { hoursSerializer } from '../../serializers/food/vendorSerializer';

export type HoursRow = Pick<HoursRange, 'weekday' | 'opensAt' | 'closesAt'>;

export interface VendorHoursSliceState {
  ranges: HoursRow[];
  status: FormStatus;
  saving: boolean;
  dirty: boolean;
  submitted: boolean;
  error: ServerError;
}

const initialState: VendorHoursSliceState = { ranges: [], status: 'idle', saving: false, dirty: false, submitted: false, error: NO_ERROR };

/** A new range: lunch when the day has none, dinner after that. */
const nextRange = (weekday: number, count: number): HoursRow =>
  count === 0 ? { weekday, opensAt: '12:00', closesAt: '15:00' } : { weekday, opensAt: '18:00', closesAt: '23:00' };

const sorted = (rows: HoursRow[]) => [...rows].sort((a, b) => a.weekday - b.weekday || a.opensAt.localeCompare(b.opensAt));

export const vendorHoursSlice = createAppSlice({
  name: 'vendorHours',
  initialState,
  reducers: create => ({
    addRange: create.reducer((state, action: PayloadAction<number>) => {
      const count = state.ranges.filter(r => r.weekday === action.payload).length;
      if (count >= MAX_RANGES_PER_DAY) return;
      state.ranges.push(nextRange(action.payload, count));
      state.dirty = true;
    }),
    /** `index` counts within the day. */
    removeRange: create.reducer((state, action: PayloadAction<{ weekday: number; index: number }>) => {
      let seen = -1;
      state.ranges = state.ranges.filter(r => r.weekday !== action.payload.weekday || ++seen !== action.payload.index);
      state.dirty = true;
    }),
    setRange: create.reducer((state, action: PayloadAction<{ weekday: number; index: number; field: 'opensAt' | 'closesAt'; value: string }>) => {
      const { weekday, index, field, value } = action.payload;
      const day = state.ranges.filter(r => r.weekday === weekday);
      if (day[index]) day[index][field] = value.slice(0, 5);
      state.dirty = true;
      state.error = NO_ERROR;
    }),
    /** Every other day (or Monday–Friday) takes this day's ranges. */
    copyDay: create.reducer((state, action: PayloadAction<{ weekday: number; to: 'all' | 'weekdays' }>) => {
      const source = state.ranges.filter(r => r.weekday === action.payload.weekday);
      const targets = action.payload.to === 'all' ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
      const others = state.ranges.filter(r => !targets.includes(r.weekday) || r.weekday === action.payload.weekday);
      const copies = targets.filter(d => d !== action.payload.weekday).flatMap(d => source.map(r => ({ ...r, weekday: d })));
      state.ranges = sorted([...others, ...copies]);
      state.dirty = true;
    }),
    markHoursSubmitted: create.reducer(state => {
      state.submitted = true;
    }),
    loadHoursAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(hoursSerializer(await getHoursAPI()));
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
          state.ranges = action.payload.map(r => ({ weekday: r.weekday, opensAt: r.opensAt, closesAt: r.closesAt }));
          state.dirty = false;
          state.submitted = false;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your hours didn't load.");
        },
      },
    ),
    saveHoursAsync: create.asyncThunk(
      async (ranges: HoursRow[], { rejectWithValue }) => {
        try {
          return required(hoursSerializer(await saveHoursAPI(ranges)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.saving = false;
          state.ranges = action.payload.map(r => ({ weekday: r.weekday, opensAt: r.opensAt, closesAt: r.closesAt }));
          state.dirty = false;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "Your hours didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorHours: state => state,
  },
});

export const { addRange, removeRange, setRange, copyDay, markHoursSubmitted, loadHoursAsync, saveHoursAsync } = vendorHoursSlice.actions;
export const { selectVendorHours } = vendorHoursSlice.selectors;
