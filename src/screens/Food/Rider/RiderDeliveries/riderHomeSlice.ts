// ═══════════════════════════════════════════════════════
// MetroMatrix — Food rider: who they are and whom they deliver for
// ═══════════════════════════════════════════════════════
// Read by Deliveries and Profile. Duty, deliveries, location and cash arrive
// with the API's rider phase.

import { createAppSlice } from '@store/createAppSlice';
import { getRiderHome } from '@networks/food/rider/riderNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { RiderHome } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export interface RiderHomeSliceState {
  home: RiderHome | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: RiderHomeSliceState = { home: null, status: 'idle', error: NO_ERROR };

export const riderHomeSlice = createAppSlice({
  name: 'riderHome',
  initialState,
  reducers: create => ({
    loadRiderHomeAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await getRiderHome();
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
          state.home = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your details didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectRiderHome: state => state,
  },
});

export const { loadRiderHomeAsync } = riderHomeSlice.actions;
export const { selectRiderHome } = riderHomeSlice.selectors;
