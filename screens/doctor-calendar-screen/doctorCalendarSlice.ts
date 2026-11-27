// MetroMatrix — Calendar: a day or a week of appointments and time off.
// Each load carries its request id (the newest answer wins when dates are
// tapped quickly), and moving to another week clears the old range, so its
// visits never show under the new date. The spinner is the pull's. Both
// views read the whole week: the day view's strip counts each day's visits,
// and moving between days of the same week needs no request.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';

import { toRejectedValue } from '../../networks/network/network';
import type { CalendarRange } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { getCalendar } from '../shared/practiceReads';
import { calendarQuery, type CalendarMode } from '../../models/health/calendarModel';
import { weekStart } from '../../utils/health-time/healthTime';

export type { CalendarMode } from '../../models/health/calendarModel';

export interface DoctorCalendarSliceState {
  mode: CalendarMode;
  /** The day shown (day mode) or any day in the week shown. */
  date: string | null;
  range: CalendarRange | null;
  /** Which day or week `range` is ("day|2026-11-27", "week|2026-11-23"). */
  rangeKey: string | null;
  requestId: string | null;
  /** A pull to refresh is running (the only time the spinner shows). */
  refreshing: boolean;
  status: FormStatus;
  error: ServerError;
}

const initialState: DoctorCalendarSliceState = {
  mode: 'day',
  date: null,
  range: null,
  rangeKey: null,
  requestId: null,
  refreshing: false,
  status: 'idle',
  error: NO_ERROR,
};

/** The week a range covers (both views read the whole week). */
export const calendarKeyOf = (date: string) => `week|${weekStart(date)}`;

export const doctorCalendarSlice = createAppSlice({
  name: 'doctorCalendar',
  initialState,
  reducers: create => ({
    setCalendarMode: create.reducer((state, action: PayloadAction<CalendarMode>) => {
      state.mode = action.payload;
    }),
    /** Another day of the week already read: no request. */
    showCalendarDay: create.reducer((state, action: PayloadAction<string>) => {
      state.date = action.payload;
    }),
    loadCalendarAsync: create.asyncThunk(
      async ({ date, mode }: { date: string; mode: CalendarMode; refresh?: boolean }, { rejectWithValue }) => {
        try {
          return await getCalendar(calendarQuery(date, 'week'));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const { date, refresh } = action.meta.arg;
          const key = calendarKeyOf(date);
          state.date = date;
          state.requestId = action.meta.requestId;
          if (state.rangeKey !== key) state.range = null;
          state.rangeKey = key;
          state.refreshing = !!refresh;
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          if (action.meta.requestId !== state.requestId) return;
          state.status = 'succeeded';
          state.refreshing = false;
          state.range = action.payload;
        },
        rejected: (state, action) => {
          if (action.meta.requestId !== state.requestId) return;
          state.status = 'failed';
          state.refreshing = false;
          state.error = readRejection(action, "The calendar didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectDoctorCalendar: state => state,
  },
});

export const { setCalendarMode, showCalendarDay, loadCalendarAsync } = doctorCalendarSlice.actions;
export const { selectDoctorCalendar } = doctorCalendarSlice.selectors;
