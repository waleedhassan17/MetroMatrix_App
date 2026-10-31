// MetroMatrix — Food Court: one tiffin subscription. Its month calendar
// (skip or un-skip a day before its cut-off), pausing, resuming,
// cancelling; read again on focus as the kitchen approves and confirms.

import { createAppSlice } from '../../store/createAppSlice';
import { cancelMyTiffinAPI, getMyTiffinAPI, getTiffinCalendarAPI, pauseMyTiffinAPI, resumeMyTiffinAPI, skipTiffinDayAPI } from '../../networks/foodGrowth/tiffinNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
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
          const [sub, calendar] = await Promise.all([getMyTiffinAPI(code).then(raw => required(tiffinSubscriptionSerializer(raw))), getTiffinCalendarAPI(code, month).then(raw => required(tiffinCalendarSerializer(raw)))]);
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
          state.status = 'succeeded';
          if (action.payload.sub) state.byCode[action.payload.sub.code] = action.payload.sub;
          state.calendars[`${action.meta.arg.code.toUpperCase()}|${action.meta.arg.month}`] = action.payload.calendar;
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
          const day = required(tiffinDaySerializer(await skipTiffinDayAPI(code, date, skip)));
          const sub = required(tiffinSubscriptionSerializer(await getMyTiffinAPI(code)));
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
          const { day, sub } = action.payload;
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
          return act.kind === 'pause' ? required(tiffinSubscriptionSerializer(await pauseMyTiffinAPI(code, act.until))) : act.kind === 'resume' ? required(tiffinSubscriptionSerializer(await resumeMyTiffinAPI(code))) : required(tiffinSubscriptionSerializer(await cancelMyTiffinAPI(code)));
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
          state.busy = null;
          if (action.payload) state.byCode[action.payload.code] = action.payload;
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
