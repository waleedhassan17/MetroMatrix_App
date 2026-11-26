// MetroMatrix — Calendar: a day or a week of appointments and time off.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';

import { toRejectedValue } from '../../networks/network/network';
import type { CalendarRange } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { getCalendar } from '../shared/practiceReads';
import { calendarQuery, type CalendarMode } from '../../models/health/calendarModel';

export type { CalendarMode } from '../../models/health/calendarModel';

export interface DoctorCalendarSliceState {
  mode: CalendarMode;
  /** The day shown (day mode) or any day in the week shown. */
  date: string | null;
  range: CalendarRange | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: DoctorCalendarSliceState = { mode: 'day', date: null, range: null, status: 'idle', error: NO_ERROR };

export const doctorCalendarSlice = createAppSlice({
  name: 'doctorCalendar',
  initialState,
  reducers: create => ({
    setCalendarMode: create.reducer((state, action: PayloadAction<CalendarMode>) => {
      state.mode = action.payload;
    }),
    loadCalendarAsync: create.asyncThunk(
      async ({ date, mode }: { date: string; mode: CalendarMode }, { rejectWithValue }) => {
        try {
          return await getCalendar(calendarQuery(date, mode));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.date = action.meta.arg.date;
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.range = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The calendar didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectDoctorCalendar: state => state,
  },
});

export const { setCalendarMode, loadCalendarAsync } = doctorCalendarSlice.actions;
export const { selectDoctorCalendar } = doctorCalendarSlice.selectors;
