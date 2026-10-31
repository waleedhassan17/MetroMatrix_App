// MetroMatrix — Kitchen: forecast and prep. What each dish is expected to
// sell on a day (the cook can set their own number), the prep sheet and
// the shopping list that follow from it, and — for a home kitchen — today's
// portions set to the plan in one tap.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { adjustForecastAPI, getForecastAPI, getForecastAccuracyAPI, getPrepSheetAPI, getShoppingListAPI } from '../../networks/kitchen/forecastNetwork';
import { setTodayAPI } from '../../networks/food/vendor/availabilityNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import { plannedOf } from '../../models/kitchen/forecastModel';
import type { Forecast, ForecastAccuracy, PrepSheet, ShoppingList } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { menuChanged } from '../vendor-menu-screen/vendorMenuSlice';
import { todayMenuSerializer } from '../../serializers/food/menuSerializer';
import { forecastSerializer, accuracySerializer, prepSheetSerializer, shoppingListSerializer, forecastItemSerializer } from '../../serializers/kitchen/forecastSerializer';

export type ForecastTab = 'forecast' | 'prep' | 'shopping';

interface Loaded<T> {
  data: T | null;
  status: FormStatus;
  error: ServerError;
}

const EMPTY = { data: null, status: 'idle', error: NO_ERROR } as const;

export interface ForecastAndPrepSliceState {
  date: string | null;
  tab: ForecastTab;
  forecast: Record<string, Loaded<Forecast>>;
  prep: Record<string, Loaded<PrepSheet>>;
  shopping: Record<string, Loaded<ShoppingList>>;
  accuracy: ForecastAccuracy | null;
  /** Prep lines ticked off, by `date|ingredientId` (this device only). */
  done: Record<string, boolean>;
  /** The dish whose number is being saved. */
  adjusting: string | null;
  applying: boolean;
  actionError: ServerError;
}

const initialState: ForecastAndPrepSliceState = {
  date: null,
  tab: 'forecast',
  forecast: {},
  prep: {},
  shopping: {},
  accuracy: null,
  done: {},
  adjusting: null,
  applying: false,
  actionError: NO_ERROR,
};

export const forecastAndPrepSlice = createAppSlice({
  name: 'forecastAndPrep',
  initialState,
  reducers: create => ({
    setForecastDate: create.reducer((state, action: PayloadAction<string>) => {
      state.date = action.payload;
      state.actionError = NO_ERROR;
    }),
    setForecastTab: create.reducer((state, action: PayloadAction<ForecastTab>) => {
      state.tab = action.payload;
    }),
    togglePrepLine: create.reducer((state, action: PayloadAction<string>) => {
      if (state.done[action.payload]) delete state.done[action.payload];
      else state.done[action.payload] = true;
    }),

    loadForecastAsync: create.asyncThunk(
      async (date: string, { rejectWithValue }) => {
        try {
          const [forecast, accuracy] = await Promise.all([getForecastAPI(date).then(raw => required(forecastSerializer(raw))), getForecastAccuracyAPI().then(raw => required(accuracySerializer(raw)))]);
          return { forecast, accuracy };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const e = (state.forecast[action.meta.arg] ??= { ...EMPTY });
          e.status = 'loading';
          e.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.forecast[action.meta.arg] = { data: action.payload.forecast, status: 'succeeded', error: NO_ERROR };
          state.accuracy = action.payload.accuracy;
        },
        rejected: (state, action) => {
          const e = (state.forecast[action.meta.arg] ??= { ...EMPTY });
          e.status = 'failed';
          e.error = readRejection(action, "The forecast didn't load.");
        },
      },
    ),

    loadPrepAsync: create.asyncThunk(
      async (date: string, { rejectWithValue }) => {
        try {
          return required(prepSheetSerializer(await getPrepSheetAPI(date)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const e = (state.prep[action.meta.arg] ??= { ...EMPTY });
          e.status = 'loading';
          e.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.prep[action.meta.arg] = { data: action.payload, status: 'succeeded', error: NO_ERROR };
        },
        rejected: (state, action) => {
          const e = (state.prep[action.meta.arg] ??= { ...EMPTY });
          e.status = 'failed';
          e.error = readRejection(action, "The prep sheet didn't load.");
        },
      },
    ),

    loadShoppingAsync: create.asyncThunk(
      async (date: string, { rejectWithValue }) => {
        try {
          return required(shoppingListSerializer(await getShoppingListAPI(date)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const e = (state.shopping[action.meta.arg] ??= { ...EMPTY });
          e.status = 'loading';
          e.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.shopping[action.meta.arg] = { data: action.payload, status: 'succeeded', error: NO_ERROR };
        },
        rejected: (state, action) => {
          const e = (state.shopping[action.meta.arg] ??= { ...EMPTY });
          e.status = 'failed';
          e.error = readRejection(action, "The shopping list didn't load.");
        },
      },
    ),

    /** The cook's own number for a dish (null: back to the forecast). The prep sheet and list follow. */
    adjustDishAsync: create.asyncThunk(
      async ({ date, itemId, adjusted }: { date: string; itemId: string; adjusted: number | null }, { dispatch, rejectWithValue }) => {
        try {
          const item = required(forecastItemSerializer(await adjustForecastAPI(date, itemId, adjusted)));
          void dispatch(loadPrepAsync(date));
          void dispatch(loadShoppingAsync(date));
          return item;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.adjusting = action.meta.arg.itemId;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.adjusting = null;
          const f = state.forecast[action.meta.arg.date]?.data;
          if (f && action.payload) f.items = f.items.map(i => (i.itemId === action.payload!.itemId ? action.payload! : i));
        },
        rejected: (state, action) => {
          state.adjusting = null;
          state.actionError = readRejection(action, "That number didn't save.");
        },
      },
    ),

    /** A home kitchen: today's portions become the plan (cooking every dish on it). */
    applyTodayPortionsAsync: create.asyncThunk(
      async (date: string, { getState, dispatch, rejectWithValue }) => {
        const f = (getState() as { forecastAndPrep: ForecastAndPrepSliceState }).forecastAndPrep.forecast[date]?.data;
        try {
          const out = required(todayMenuSerializer(await setTodayAPI((f?.items ?? []).map(i => ({ itemId: i.itemId, portions: plannedOf(i), cooking: true })))));
          dispatch(menuChanged());
          return out;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.applying = true;
          state.actionError = NO_ERROR;
        },
        fulfilled: state => {
          state.applying = false;
        },
        rejected: (state, action) => {
          state.applying = false;
          state.actionError = readRejection(action, "Today's portions didn't change.");
        },
      },
    ),
  }),
  selectors: {
    selectForecastAndPrep: state => state,
  },
});

export const { setForecastDate, setForecastTab, togglePrepLine, loadForecastAsync, loadPrepAsync, loadShoppingAsync, adjustDishAsync, applyTodayPortionsAsync } =
  forecastAndPrepSlice.actions;
export const { selectForecastAndPrep } = forecastAndPrepSlice.selectors;
