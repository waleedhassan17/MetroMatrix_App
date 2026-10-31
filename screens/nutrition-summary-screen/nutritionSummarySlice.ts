// MetroMatrix — the customer's week of ordered food (Food Court only).

import { createAppSlice } from '../../store/createAppSlice';
import { fetchNutritionSummary } from '../../networks/myKitchen/nutrition';
import { toRejectedValue } from '../../networks/network/network';
import type { NutritionSummary } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { nutritionSummarySerializer } from '../../serializers/myKitchen/myKitchenSerializer';

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
          return await fetchNutritionSummary(7);
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
          const payload = nutritionSummarySerializer(action.payload);
          state.status = 'succeeded';
          state.summary = payload;
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
