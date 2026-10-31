// MetroMatrix — Food Court: the customer's tiffin subscriptions, newest first.

import { createAppSlice } from '../../store/createAppSlice';
import { fetchMyTiffins } from '../../networks/foodGrowth/tiffin';
import { toRejectedValue } from '../../networks/network/network';
import type { TiffinSubscription } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { tiffinSubscriptionsSerializer } from '../../serializers/kitchen/growthSerializer';

export interface FoodTiffinsSliceState {
  items: TiffinSubscription[];
  status: FormStatus;
  error: ServerError;
}

const initialState: FoodTiffinsSliceState = { items: [], status: 'idle', error: NO_ERROR };

export const foodTiffinsSlice = createAppSlice({
  name: 'foodTiffins',
  initialState,
  reducers: create => ({
    loadMyTiffinsAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await fetchMyTiffins();
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
          const payload = tiffinSubscriptionsSerializer(action.payload);
          state.status = 'succeeded';
          state.items = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your tiffins didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectFoodTiffins: state => state,
  },
});

export const { loadMyTiffinsAsync } = foodTiffinsSlice.actions;
export const { selectFoodTiffins } = foodTiffinsSlice.selectors;
