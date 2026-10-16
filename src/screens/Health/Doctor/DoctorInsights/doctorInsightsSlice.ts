// MetroMatrix — Insights for 7, 30 or 90 days (recorded from completed visits).

import { createAppSlice } from '@store/createAppSlice';
import { getInsights } from '@networks/health/doctor/doctorInsightsNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { DoctorInsights, DoctorInsightsRange } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export interface DoctorInsightsSliceState {
  range: DoctorInsightsRange;
  insights: DoctorInsights | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: DoctorInsightsSliceState = { range: '30d', insights: null, status: 'idle', error: NO_ERROR };

export const doctorInsightsSlice = createAppSlice({
  name: 'doctorInsights',
  initialState,
  reducers: create => ({
    loadInsightsAsync: create.asyncThunk(
      async (range: DoctorInsightsRange, { rejectWithValue }) => {
        try {
          return await getInsights(range);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.range = action.meta.arg;
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.insights = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Insights didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectDoctorInsights: state => state,
  },
});

export const { loadInsightsAsync } = doctorInsightsSlice.actions;
export const { selectDoctorInsights } = doctorInsightsSlice.selectors;
