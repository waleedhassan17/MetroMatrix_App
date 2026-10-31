// MetroMatrix — Insights slice: recorded sales and orders over a range.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../../store/createAppSlice';
import { getInsightsAPI } from '../../../../networks/shopping/partner/insightsNetwork';
import { toRejectedValue, required } from '../../../../networks/network/apiHelpers';
import type { Insights, InsightsRange } from '../../../../types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { insightsSerializer } from '../../../../serializers/shopping/partnerSerializer';

export interface InsightsSliceState {
  range: InsightsRange;
  data: Insights | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: InsightsSliceState = { range: '7d', data: null, status: 'idle', error: NO_ERROR };

export const insightsSlice = createAppSlice({
  name: 'insights',
  initialState,
  reducers: create => ({
    setInsightsRange: create.reducer((state, action: PayloadAction<InsightsRange>) => {
      state.range = action.payload;
    }),
    loadInsightsAsync: create.asyncThunk(
      async (range: InsightsRange, { rejectWithValue }) => {
        try {
          return required(insightsSerializer(await getInsightsAPI(range)));
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
          if (action.meta.arg !== state.range) return;
          state.status = 'succeeded';
          state.data = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't load your insights.");
        },
      },
    ),
  }),
  selectors: {
    selectInsights: state => state,
  },
});

export const { setInsightsRange, loadInsightsAsync } = insightsSlice.actions;
export const { selectInsights } = insightsSlice.selectors;
