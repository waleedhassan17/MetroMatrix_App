// MetroMatrix — Food Court: every Bachat Box near the customer's point
// (pickup today, nearest first).

import { createAppSlice } from '@store/createAppSlice';
import { getSurplusNearbyAPI } from '@networks/food/surplusNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { FoodPoint, SurplusCard } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { surplusCardsSerializer } from '@serializers/kitchen/surplusSerializer';

export interface SurplusListSliceState {
  items: SurplusCard[];
  status: FormStatus;
  error: ServerError;
}

const initialState: SurplusListSliceState = { items: [], status: 'idle', error: NO_ERROR };

export const surplusListSlice = createAppSlice({
  name: 'surplusList',
  initialState,
  reducers: create => ({
    loadSurplusListAsync: create.asyncThunk(
      async (at: Pick<FoodPoint, 'lat' | 'lng'>, { rejectWithValue }) => {
        try {
          return required(surplusCardsSerializer(await getSurplusNearbyAPI(at)));
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
          state.error = readRejection(action, "Bachat Boxes didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectSurplusList: state => state,
  },
});

export const { loadSurplusListAsync } = surplusListSlice.actions;
export const { selectSurplusList } = surplusListSlice.selectors;
