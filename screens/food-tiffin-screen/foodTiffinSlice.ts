// MetroMatrix — Food Court: one tiffin subscription. Its month calendar
// (skip or un-skip a day before its cut-off), pausing, resuming,
// cancelling; read again on focus as the kitchen approves and confirms.

import { createAppSlice } from '../../store/createAppSlice';
import { cancelMyTiffin, fetchMyTiffin, fetchTiffinCalendar, pauseMyTiffin, resumeMyTiffin, skipTiffinDay } from '../../networks/foodGrowth/tiffin';
import { toRejectedValue } from '../../networks/network/network';
import type { TiffinCalendar, TiffinSubscription } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { tiffinSubscriptionSerializer, tiffinCalendarSerializer, tiffinDaySerializer } from '../../serializers/kitchen/growthSerializer';

export type TiffinAct = { kind: 'pause'; until: string | null } | { kind: 'resume' } | { kind: 'cancel' };

export interface FoodTiffinSliceState {
  byCode: Record<string, TiffinSubscription>;
  /** `${code}|${month}` → the calendar. */
  calendars: Record<string, TiffinCalendar>;
  status: FormStatus;
  error: ServerError;
  /** The day (or 'sub') a change is in flight for. */
  busy: string | null;
  actionError: ServerError;
}

const initialState: FoodTiffinSliceState = { byCode: {}, calendars: {}, status: 'idle', error: NO_ERROR, busy: null, actionError: NO_ERROR };

export const foodTiffinSlice = createAppSlice({
  name: 'foodTiffin',
  initialState,
  reducers: create => ({
    loadMyTiffinAsync: create.asyncThunk(
      async ({ code, month }: { code: string; month: string }, { rejectWithValue }) => {
        try {
          const [sub, calendar] = await Promise.all([fetchMyTiffin(code), fetchTiffinCalendar(code, month)]);
          return { sub, calendar };
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
          const payload = { sub: tiffinSubscriptionSerializer(action.payload.sub), calendar: tiffinCalendarSerializer(action.payload.calendar) };
          state.status = 'succeeded';
          if (payload.sub) state.byCode[payload.sub.code] = payload.sub;
          state.calendars[`${action.meta.arg.code.toUpperCase()}|${action.meta.arg.month}`] = payload.calendar;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your tiffin didn't load.");
        },
      },
    ),
    tiffinDayAsync: create.asyncThunk(
      async ({ code, date, skip }: { code: string; date: string; skip: boolean }, { rejectWithValue }) => {
        try {
          const day = await skipTiffinDay(code, date, skip);
          const sub = await fetchMyTiffin(code);
          return { day, sub };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busy = action.meta.arg.date;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = null;
          const day = tiffinDaySerializer(action.payload.day);
          const sub = tiffinSubscriptionSerializer(action.payload.sub);
          if (sub) state.byCode[sub.code] = sub;
          const cal = day ? state.calendars[`${action.meta.arg.code.toUpperCase()}|${day.date.slice(0, 7)}`] : undefined;
          if (cal && day) cal.days = cal.days.map(d => (d.date === day.date ? day : d));
        },
        rejected: (state, action) => {
          state.busy = null;
          state.actionError = readRejection(action, "That day didn't change.");
        },
      },
    ),
    tiffinActAsync: create.asyncThunk(
      async ({ code, act }: { code: string; act: TiffinAct }, { rejectWithValue }) => {
        try {
          return act.kind === 'pause' ? await pauseMyTiffin(code, act.until) : act.kind === 'resume' ? await resumeMyTiffin(code) : await cancelMyTiffin(code);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = 'sub';
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const sub = tiffinSubscriptionSerializer(action.payload);
          state.busy = null;
          if (sub) state.byCode[sub.code] = sub;
        },
        rejected: (state, action) => {
          state.busy = null;
          state.actionError = readRejection(action, "That didn't change.");
        },
      },
    ),
  }),
  selectors: {
    selectFoodTiffinUi: state => state,
    selectMyTiffin: (state, code: string): TiffinSubscription | null => state.byCode[code.toUpperCase()] ?? null,
    selectTiffinCalendar: (state, code: string, month: string): TiffinCalendar | null => state.calendars[`${code.toUpperCase()}|${month}`] ?? null,
  },
});

export const { loadMyTiffinAsync, tiffinDayAsync, tiffinActAsync } = foodTiffinSlice.actions;
export const { selectFoodTiffinUi, selectMyTiffin, selectTiffinCalendar } = foodTiffinSlice.selectors;
