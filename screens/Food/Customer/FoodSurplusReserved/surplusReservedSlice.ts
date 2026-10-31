// MetroMatrix — Food Court: one Bachat Box reservation (its pickup code,
// how it is paid, cancelling before the window). Read again on focus: the
// kitchen collects it, confirms a transfer, or marks a no-show.

import { createAppSlice } from '../../../../store/createAppSlice';
import { cancelReservationAPI, getReservationAPI } from '../../../../networks/food/surplusNetwork';
import { toRejectedValue, required } from '../../../../networks/network/apiHelpers';
import type { SurplusReservation } from '../../../../types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { reservationSerializer } from '../../../../serializers/kitchen/surplusSerializer';

export interface SurplusReservedSliceState {
  byCode: Record<string, SurplusReservation>;
  status: FormStatus;
  error: ServerError;
  cancelling: boolean;
  cancelError: ServerError;
}

const initialState: SurplusReservedSliceState = { byCode: {}, status: 'idle', error: NO_ERROR, cancelling: false, cancelError: NO_ERROR };

export const surplusReservedSlice = createAppSlice({
  name: 'surplusReserved',
  initialState,
  reducers: create => ({
    loadReservationAsync: create.asyncThunk(
      async (code: string, { rejectWithValue }) => {
        try {
          return required(reservationSerializer(await getReservationAPI(code)));
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
          if (action.payload) state.byCode[action.payload.code] = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your reservation didn't load.");
        },
      },
    ),
    cancelReservationAsync: create.asyncThunk(
      async (code: string, { rejectWithValue }) => {
        try {
          return required(reservationSerializer(await cancelReservationAPI(code)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.cancelling = true;
          state.cancelError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.cancelling = false;
          if (action.payload) state.byCode[action.payload.code] = action.payload;
        },
        rejected: (state, action) => {
          state.cancelling = false;
          state.cancelError = readRejection(action, "It didn't cancel.");
        },
      },
    ),
  }),
  selectors: {
    selectSurplusReserved: state => state,
    selectReservation: (state, code: string): SurplusReservation | null => state.byCode[code.toUpperCase()] ?? null,
  },
});

export const { loadReservationAsync, cancelReservationAsync } = surplusReservedSlice.actions;
export const { selectSurplusReserved, selectReservation } = surplusReservedSlice.selectors;
