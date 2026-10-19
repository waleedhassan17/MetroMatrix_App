// MetroMatrix — Kitchen: the price watch (what the kitchen pays more for than the city).

import { createAppSlice } from '@store/createAppSlice';
import { getPriceWatch } from '@networks/kitchen/purchasesNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { PriceWatch } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export interface PriceWatchSliceState {
  watch: PriceWatch | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: PriceWatchSliceState = { watch: null, status: 'idle', error: NO_ERROR };

export const priceWatchSlice = createAppSlice({
  name: 'priceWatch',
  initialState,
  reducers: create => ({
    loadPriceWatchAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await getPriceWatch();
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
          state.watch = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The price watch didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectPriceWatch: state => state,
  },
});

export const { loadPriceWatchAsync } = priceWatchSlice.actions;
export const { selectPriceWatch } = priceWatchSlice.selectors;
