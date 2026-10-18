// MetroMatrix — Admin Food overview slice.

import { createAppSlice } from '@store/createAppSlice';
import { getFoodOverview } from '@networks/admin/adminFoodNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { AdminFoodOverview } from '@/types';
import {
  NO_ERROR,
  readRejection,
  type FormStatus,
  type ServerError,
} from '../../../Auth/shared/formStatus';

export interface FoodOverviewSliceState {
  overview: AdminFoodOverview | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: FoodOverviewSliceState = { overview: null, status: 'idle', error: NO_ERROR };

export const foodOverviewSlice = createAppSlice({
  name: 'foodOverview',
  initialState,
  reducers: create => ({
    loadFoodOverviewAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await getFoodOverview();
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
          state.overview = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't load the overview.");
        },
      },
    ),
  }),
  selectors: {
    selectFoodOverview: state => state,
  },
});

export const { loadFoodOverviewAsync } = foodOverviewSlice.actions;
export const { selectFoodOverview } = foodOverviewSlice.selectors;
