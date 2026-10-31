// MetroMatrix — Food Court: the customer's dawat requests, latest first.

import { createAppSlice } from '../../store/createAppSlice';
import { getMyCateringRequestsAPI } from '../../networks/foodGrowth/cateringNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import type { CateringRequest } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { cateringRequestsSerializer } from '../../serializers/kitchen/growthSerializer';

export interface FoodCateringRequestsSliceState {
  items: CateringRequest[];
  status: FormStatus;
  error: ServerError;
}

const initialState: FoodCateringRequestsSliceState = { items: [], status: 'idle', error: NO_ERROR };

export const foodCateringRequestsSlice = createAppSlice({
  name: 'foodCateringRequests',
  initialState,
  reducers: create => ({
    loadMyCateringAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(cateringRequestsSerializer(await getMyCateringRequestsAPI()));
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
          state.items = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your requests didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectFoodCateringRequests: state => state,
  },
});

export const { loadMyCateringAsync } = foodCateringRequestsSlice.actions;
export const { selectFoodCateringRequests } = foodCateringRequestsSlice.selectors;
