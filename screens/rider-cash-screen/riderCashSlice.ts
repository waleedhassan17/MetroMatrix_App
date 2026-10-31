// ═══════════════════════════════════════════════════════
// MetroMatrix — Food rider: the cash they hold
// ═══════════════════════════════════════════════════════
// Cash collected at doors adds up; what they hand over at the kitchen comes
// off (the vendor records it). Newest first.

import { createAppSlice } from '../../store/createAppSlice';
import { getRiderCashAPI } from '../../networks/food/rider/riderNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import type { RiderCash } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { riderCashSerializer } from '../../serializers/food/riderSerializer';

export interface RiderCashSliceState {
  cash: RiderCash | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: RiderCashSliceState = { cash: null, status: 'idle', error: NO_ERROR };

export const riderCashSlice = createAppSlice({
  name: 'riderCash',
  initialState,
  reducers: create => ({
    loadRiderCashAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(riderCashSerializer(await getRiderCashAPI()));
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
          state.cash = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your cash didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectRiderCash: state => state,
  },
});

export const { loadRiderCashAsync } = riderCashSlice.actions;
export const { selectRiderCash } = riderCashSlice.selectors;
