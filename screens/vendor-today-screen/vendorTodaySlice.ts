// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor (home kitchen): Today
// ═══════════════════════════════════════════════════════
// What is cooking today and how many plates: setting portions resets what is
// left; a dish switched off is off for today only. Changes collect locally
// and go up together. The kitchen's forecast for today (TODO(API_KITCHEN))
// offers its numbers as portions in one tap; spoken portions land the same way.

import { createSelector, type PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { getTodayAPI, setTodayAPI } from '../../networks/food/vendor/availabilityNetwork';
import { getForecastAPI } from '../../networks/kitchen/forecastNetwork';
import { getTiffinTomorrowAPI } from '../../networks/foodGrowth/tiffinNetwork';
import { suggestedPortions } from '../../models/kitchen/forecastModel';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import type { Forecast, TiffinTomorrow, TodayMenu } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { menuChanged } from '../vendor-menu-screen/vendorMenuSlice';
import { todayMenuSerializer } from '../../serializers/food/menuSerializer';
import { forecastSerializer } from '../../serializers/kitchen/forecastSerializer';
import { tiffinTomorrowSerializer } from '../../serializers/kitchen/growthSerializer';

export interface TodayEdit {
  portions?: number | null;
  cooking?: boolean;
}

export interface VendorTodaySliceState {
  today: TodayMenu | null;
  edits: Record<string, TodayEdit>;
  status: FormStatus;
  saving: boolean;
  error: ServerError;
  /** Today's forecast (null when the kitchen side is unavailable). */
  forecast: Forecast | null;
  /** Tomorrow's tiffins (null without any, or when unavailable). */
  tiffin: TiffinTomorrow | null;
}

const initialState: VendorTodaySliceState = { today: null, edits: {}, status: 'idle', saving: false, error: NO_ERROR, forecast: null, tiffin: null };

export const vendorTodaySlice = createAppSlice({
  name: 'vendorToday',
  initialState,
  reducers: create => ({
    editToday: create.reducer((state, action: PayloadAction<{ itemId: string; edit: TodayEdit }>) => {
      const { itemId, edit } = action.payload;
      const row = state.today?.items.find(i => i.itemId === itemId);
      const next = { ...state.edits[itemId], ...edit };
      // Back to what the server has: nothing to send for it.
      if (row && (next.portions === undefined || next.portions === row.dailyLimit) && (next.cooking === undefined || next.cooking === row.cooking)) delete state.edits[itemId];
      else state.edits[itemId] = next;
    }),
    discardToday: create.reducer(state => {
      state.edits = {};
    }),
    /** The forecast's numbers (or spoken ones) as today's portions, cooking each: saved with "Save today". */
    applyPortions: create.reducer((state, action: PayloadAction<{ itemId: string; portions: number }[]>) => {
      for (const { itemId, portions } of action.payload) {
        const row = state.today?.items.find(i => i.itemId === itemId && i.onTodaysMenu);
        if (!row) continue;
        if (row.dailyLimit === portions && row.cooking) delete state.edits[itemId];
        else state.edits[itemId] = { portions, cooking: true };
      }
    }),
    loadTodayAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          const today = required(todayMenuSerializer(await getTodayAPI()));
          const [forecast, tiffin] = await Promise.all([today ? getForecastAPI(today.date).then(raw => required(forecastSerializer(raw))).catch(() => null) : null, getTiffinTomorrowAPI().then(raw => required(tiffinTomorrowSerializer(raw))).catch(() => null)]);
          return { today, forecast, tiffin };
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
          state.today = action.payload.today;
          state.forecast = action.payload.forecast;
          state.tiffin = action.payload.tiffin;
          state.edits = {};
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Today's menu didn't load.");
        },
      },
    ),
    saveTodayAsync: create.asyncThunk(
      async (_: void, { getState, dispatch, rejectWithValue }) => {
        const { edits } = (getState() as { vendorToday: VendorTodaySliceState }).vendorToday;
        try {
          const out = required(todayMenuSerializer(await setTodayAPI(Object.entries(edits).map(([itemId, e]) => ({ itemId, ...e })))));
          dispatch(menuChanged());
          return out;
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
          state.today = action.payload;
          state.edits = {};
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "Today's changes didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorToday: state => state,
  },
});

export const { editToday, discardToday, applyPortions, loadTodayAsync, saveTodayAsync } = vendorTodaySlice.actions;
export const { selectVendorToday } = vendorTodaySlice.selectors;

/** The forecast's portions that differ from today's (what the banner offers). */
export const selectSuggestedPortions = createSelector(
  [(state: { vendorToday: VendorTodaySliceState }) => state.vendorToday.today, (state: { vendorToday: VendorTodaySliceState }) => state.vendorToday.forecast],
  (today, forecast) => (today && forecast ? suggestedPortions(today, forecast) : []),
);
