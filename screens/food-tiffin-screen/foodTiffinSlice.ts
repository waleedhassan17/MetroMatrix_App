// MetroMatrix — Food Court: one tiffin subscription. Its month calendar
// (skip or un-skip a day before its cut-off), pausing, resuming,
// cancelling; read again on focus as the kitchen approves and confirms.

import { createAppSlice } from '../../store/createAppSlice';
import { cancelMyTiffin, fetchMyTiffins, fetchTiffinCalendar, pauseMyTiffin, resumeMyTiffin, skipTiffinDay } from '../../networks/foodGrowth/tiffin';
import { toRejectedValue } from '../../networks/network/network';
import type { TiffinCalendar, TiffinSubscription } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { myTiffinSerializer, tiffinSubscriptionSerializer, tiffinCalendarSerializer } from '../../serializers/kitchen/growthSerializer';

export type TiffinAct = { kind: 'pause'; until: string } | { kind: 'resume' } | { kind: 'cancel' };

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
          // The customer's subscriptions hold this one (`code` is its id).
          const [sub, calendar] = await Promise.all([fetchMyTiffins(), fetchTiffinCalendar(code, month)]);
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
          const payload = { sub: myTiffinSerializer(action.payload.sub, action.meta.arg.code), calendar: tiffinCalendarSerializer(action.payload.calendar) };
          state.status = payload.sub ? 'succeeded' : 'failed';
          if (payload.sub) state.byCode[payload.sub.code] = payload.sub;
          else state.error = { ...NO_ERROR, code: 'NOT_FOUND', message: 'This tiffin isn’t one of yours.' };
          state.calendars[`${action.meta.arg.code}|${action.meta.arg.month}`] = payload.calendar;
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
          // The subscription comes back; the month is read again for the day's new state.
          const sub = await skipTiffinDay(code, date, skip);
          const calendar = await fetchTiffinCalendar(code, date.slice(0, 7));
          return { sub, calendar };
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
          const sub = tiffinSubscriptionSerializer(action.payload.sub);
          if (sub) state.byCode[sub.code] = sub;
          state.calendars[`${action.meta.arg.code}|${action.meta.arg.date.slice(0, 7)}`] = tiffinCalendarSerializer(action.payload.calendar);
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
    selectMyTiffin: (state, code: string): TiffinSubscription | null => state.byCode[code] ?? null,
    selectTiffinCalendar: (state, code: string, month: string): TiffinCalendar | null => state.calendars[`${code}|${month}`] ?? null,
  },
});

export const { loadMyTiffinAsync, tiffinDayAsync, tiffinActAsync } = foodTiffinSlice.actions;
export const { selectFoodTiffinUi, selectMyTiffin, selectTiffinCalendar } = foodTiffinSlice.selectors;
