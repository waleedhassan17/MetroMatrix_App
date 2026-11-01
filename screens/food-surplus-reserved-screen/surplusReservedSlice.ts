// MetroMatrix — Food Court: one Bachat Box reservation (its pickup code,
// how it is paid, cancelling before the window). Read again on focus: the
// kitchen collects it, confirms a transfer, or marks a no-show.

import { createAppSlice } from '../../store/createAppSlice';
import { cancelReservation, fetchMyReservations } from '../../networks/food/surplus';
import { required, toRejectedValue } from '../../networks/network/network';
import type { SurplusReservation } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { myReservationSerializer, reservationSerializer } from '../../serializers/kitchen/surplusSerializer';

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
          // There is no single read: the customer's reservations hold it.
          return await fetchMyReservations();
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
          const payload = myReservationSerializer(action.payload, action.meta.arg.toUpperCase());
          state.status = payload ? 'succeeded' : 'failed';
          if (payload) state.byCode[payload.code] = payload;
          else state.error = { ...NO_ERROR, code: 'NOT_FOUND', message: 'This reservation isn’t one of yours.' };
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your reservation didn't load.");
        },
      },
    ),
    cancelReservationAsync: create.asyncThunk(
      async (code: string, { getState, rejectWithValue }) => {
        try {
          const held = (getState() as { surplusReserved: SurplusReservedSliceState }).surplusReserved.byCode[code];
          const id = held?.id ?? required(myReservationSerializer(await fetchMyReservations(), code)).id;
          return await cancelReservation(id);
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
          const payload = reservationSerializer(action.payload);
          state.cancelling = false;
          if (payload) state.byCode[payload.code] = payload;
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
