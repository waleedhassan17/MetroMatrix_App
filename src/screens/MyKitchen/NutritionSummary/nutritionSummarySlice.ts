// MetroMatrix — the customer's week of ordered food (Food Court only).

import { createAppSlice } from '@store/createAppSlice';
import { getNutritionSummary } from '@networks/myKitchen/nutritionNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { NutritionSummary } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../Auth/shared/formStatus';

export interface NutritionSummarySliceState {
  summary: NutritionSummary | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: NutritionSummarySliceState = { summary: null, status: 'idle', error: NO_ERROR };

export const nutritionSummarySlice = createAppSlice({
  name: 'nutritionSummary',
  initialState,
  reducers: create => ({
    loadNutritionSummaryAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await getNutritionSummary(7);
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
          state.summary = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The summary didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectNutritionSummary: state => state,
  },
});

export const { loadNutritionSummaryAsync } = nutritionSummarySlice.actions;
export const { selectNutritionSummary } = nutritionSummarySlice.selectors;
