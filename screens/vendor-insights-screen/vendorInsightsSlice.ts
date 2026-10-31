// MetroMatrix — Food vendor insights slice: the range, and its numbers (kept
// per range, so switching back doesn't reload).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchFoodInsights } from '../../networks/food/vendor/insights';
import { toRejectedValue, required } from '../../networks/network/network';
import type { FoodInsights, FoodInsightsRange } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { foodInsightsSerializer } from '../../serializers/food/reviewSerializer';

export interface VendorInsightsSliceState {
  range: FoodInsightsRange;
  byRange: Partial<Record<FoodInsightsRange, FoodInsights>>;
  status: FormStatus;
  error: ServerError;
}

const initialState: VendorInsightsSliceState = { range: '7d', byRange: {}, status: 'idle', error: NO_ERROR };

export const vendorInsightsSlice = createAppSlice({
  name: 'vendorInsights',
  initialState,
  reducers: create => ({
    setFoodInsightsRange: create.reducer((state, action: PayloadAction<FoodInsightsRange>) => {
      state.range = action.payload;
      state.error = NO_ERROR;
    }),
    loadFoodInsightsAsync: create.asyncThunk(
      async (range: FoodInsightsRange, { rejectWithValue }) => {
        try {
          return required(foodInsightsSerializer(await fetchFoodInsights(range)));
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
          state.byRange[action.meta.arg] = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't load your numbers.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorInsights: state => state,
  },
});

export const { setFoodInsightsRange, loadFoodInsightsAsync } = vendorInsightsSlice.actions;
export const { selectVendorInsights } = vendorInsightsSlice.selectors;
