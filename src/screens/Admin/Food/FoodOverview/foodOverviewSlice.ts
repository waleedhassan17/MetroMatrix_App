// MetroMatrix — Admin Food overview slice. The Food API's overview, and
// what the Kitchen tools have waiting (hygiene checks, new signature
// dishes), which the assumed kitchen contract serves on its own routes.

import { createAppSlice } from '@store/createAppSlice';
import { getFoodOverviewAPI } from '@networks/admin/adminFoodNetwork';
import { getHygieneQueueAPI, getSignaturesAPI } from '@networks/admin/adminKitchenNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { AdminFoodOverview } from '@/types';
import {
  NO_ERROR,
  readRejection,
  type FormStatus,
  type ServerError,
} from '../../../Auth/shared/formStatus';
import { adminFoodOverviewSerializer } from '@serializers/food/adminFoodSerializer';
import { hygieneQueueSerializer } from '@serializers/kitchen/reachSerializer';
import { signatureListSerializer } from '@serializers/kitchen/adminKitchenSerializer';

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
          return required(adminFoodOverviewSerializer(await getFoodOverviewAPI()));
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

    // TODO(API_KITCHEN): one overview route would serve these counts.
    loadKitchenWaitingAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          const [hygiene, signatures] = await Promise.all([getHygieneQueueAPI('pending').then(raw => required(hygieneQueueSerializer(raw))), getSignaturesAPI('new').then(raw => required(signatureListSerializer(raw)))]);
          return { hygiene: hygiene.length, signatures: signatures.counts.new };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          state.kitchen = action.payload;
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
