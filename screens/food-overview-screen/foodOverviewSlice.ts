// MetroMatrix — Admin Food overview slice. The Food API's overview, and
// what the Kitchen tools have waiting (hygiene checks, new signature
// dishes), which the assumed kitchen contract serves on its own routes.

import { createAppSlice } from '../../store/createAppSlice';
import { fetchFoodOverview } from '../../networks/admin/adminFood';
import { fetchHygieneQueue } from '../../networks/admin/adminKitchen';
import { toRejectedValue } from '../../networks/network/network';
import type { AdminFoodOverview } from '../../models';
import {
  NO_ERROR,
  readRejection,
  type FormStatus,
  type ServerError,
} from '../shared/formStatus';
import { adminFoodOverviewSerializer } from '../../serializers/food/adminFoodSerializer';
import { hygieneQueueSerializer } from '../../serializers/kitchen/adminKitchenSerializer';

export interface FoodOverviewSliceState {
  overview: AdminFoodOverview | null;
  status: FormStatus;
  error: ServerError;
  /** The Kitchen tools' waiting work; null until read (a failure leaves it null, quietly). */
  kitchen: { hygiene: number; signatures: number } | null;
}

const initialState: FoodOverviewSliceState = { overview: null, status: 'idle', error: NO_ERROR, kitchen: null };

export const foodOverviewSlice = createAppSlice({
  name: 'foodOverview',
  initialState,
  reducers: create => ({
    loadFoodOverviewAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await fetchFoodOverview();
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
          const payload = adminFoodOverviewSerializer(action.payload);
          state.status = 'succeeded';
          state.overview = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't load the overview.");
        },
      },
    ),

    // What waits on staff in the Kitchen tools: complete hygiene checklists to verify (signature claims go live on their own).
    loadKitchenWaitingAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return { hygiene: await fetchHygieneQueue('self_declared') };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          state.kitchen = {
            hygiene: hygieneQueueSerializer(action.payload.hygiene).length,
            signatures: 0,
          };
        },
      },
    ),
  }),
  selectors: {
    selectFoodOverview: state => state,
  },
});

export const { loadFoodOverviewAsync, loadKitchenWaitingAsync } = foodOverviewSlice.actions;
export const { selectFoodOverview } = foodOverviewSlice.selectors;
