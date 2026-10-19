// MetroMatrix — Food Court: the customer's Bachat Box reservations, newest first.

import { createAppSlice } from '@store/createAppSlice';
import { listMyReservations } from '@networks/food/surplusNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { SurplusReservation } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export interface SurplusReservationsSliceState {
  items: SurplusReservation[];
  status: FormStatus;
  error: ServerError;
}

const initialState: SurplusReservationsSliceState = { items: [], status: 'idle', error: NO_ERROR };

export const surplusReservationsSlice = createAppSlice({
  name: 'surplusReservations',
  initialState,
  reducers: create => ({
    loadMyReservationsAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await listMyReservations();
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
          state.error = readRejection(action, "Your reservations didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectMyReservations: state => state,
  },
});

export const { loadMyReservationsAsync } = surplusReservationsSlice.actions;
export const { selectMyReservations } = surplusReservationsSlice.selectors;
