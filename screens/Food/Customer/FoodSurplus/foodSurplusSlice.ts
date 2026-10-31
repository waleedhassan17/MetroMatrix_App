// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: a Bachat Box (customer)
// ═══════════════════════════════════════════════════════
// One box: what it is worth and costs, the pickup window and place, how
// many are left. Reserving takes an Idempotency-Key — one per attempt,
// kept for its retries, so a retry never reserves twice — and answers
// "someone just reserved the last one" plainly (409 SURPLUS_SOLD_OUT).
// TODO(API_KITCHEN): docs/API_KITCHEN_ASSUMED.md §4.4.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../../store/createAppSlice';
import { getSurplusAPI, reserveSurplusAPI } from '../../../../networks/food/surplusNetwork';
import { toRejectedValue, required } from '../../../../networks/network/apiHelpers';
import { newUuid } from '../../../../utils/ids';
import type { BoxPaymentMethod, FoodPoint, SurplusDetail } from '../../../../types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { surplusDetailSerializer, reservationSerializer } from '../../../../serializers/kitchen/surplusSerializer';

export interface FoodSurplusSliceState {
  box: SurplusDetail | null;
  status: FormStatus;
  error: ServerError;
  quantity: number;
  method: BoxPaymentMethod;
  idempotencyKey: string;
  reserving: boolean;
  reserveError: ServerError;
}

const initialState: FoodSurplusSliceState = {
  box: null,
  status: 'idle',
  error: NO_ERROR,
  quantity: 1,
  method: 'pay_at_pickup',
  idempotencyKey: '',
  reserving: false,
  reserveError: NO_ERROR,
};

export const foodSurplusSlice = createAppSlice({
  name: 'foodSurplus',
  initialState,
  reducers: create => ({
    /** A fresh attempt: on arrival, and after a reservation is made. */
    newSurplusKey: create.preparedReducer(
      () => ({ payload: newUuid() }),
      (state, action: PayloadAction<string>) => {
        state.idempotencyKey = action.payload;
      },
    ),
    setSurplusQuantity: create.reducer((state, action: PayloadAction<number>) => {
      state.quantity = action.payload;
      state.reserveError = NO_ERROR;
    }),
    setSurplusMethod: create.reducer((state, action: PayloadAction<BoxPaymentMethod>) => {
      state.method = action.payload;
      state.reserveError = NO_ERROR;
    }),

    loadSurplusAsync: create.asyncThunk(
      async ({ id, at }: { id: string; at: Pick<FoodPoint, 'lat' | 'lng'> | null }, { rejectWithValue }) => {
        try {
          return required(surplusDetailSerializer(await getSurplusAPI(id, at)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          if (state.box?.id !== action.meta.arg.id) {
            state.box = null;
            state.quantity = 1;
            state.method = 'pay_at_pickup';
            state.reserveError = NO_ERROR;
          }
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.box = action.payload;
          if (action.payload) {
            state.quantity = Math.max(1, Math.min(state.quantity, action.payload.maxPerCustomer, action.payload.left || 1));
            if (!action.payload.paymentMethods.includes(state.method)) state.method = action.payload.paymentMethods[0] ?? 'pay_at_pickup';
          }
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "This Bachat Box didn't load.");
        },
      },
    ),

    reserveSurplusAsync: create.asyncThunk(
      async (_: void, { getState, dispatch, rejectWithValue }) => {
        const s = (getState() as { foodSurplus: FoodSurplusSliceState }).foodSurplus;
        if (!s.box) return rejectWithValue({ message: 'This Bachat Box is no longer available.', code: 'NOT_FOUND' });
        try {
          const r = required(reservationSerializer(await reserveSurplusAPI(s.box.id, { quantity: s.quantity, paymentMethod: s.method }, s.idempotencyKey || newUuid())));
          dispatch(newSurplusKey());
          return r;
        } catch (e) {
          const err = toRejectedValue(e);
          // A definite answer (not a dropped connection) ends this attempt: the next tap is a new one.
          if (err.status) dispatch(newSurplusKey());
          return rejectWithValue(err);
        }
      },
      {
        pending: state => {
          state.reserving = true;
          state.reserveError = NO_ERROR;
        },
        fulfilled: state => {
          state.reserving = false;
        },
        rejected: (state, action) => {
          state.reserving = false;
          state.reserveError = readRejection(action, "We couldn't reserve it. Try again.");
          // Sold out under us: the box's own numbers follow.
          const left = (state.reserveError.details as { left?: number } | null)?.left;
          if (state.box && state.reserveError.code === 'SURPLUS_SOLD_OUT' && typeof left === 'number') {
            state.box.left = left;
            if (left <= 0) state.box.status = 'sold_out';
            state.quantity = Math.max(1, Math.min(state.quantity, left));
          }
        },
      },
    ),
  }),
  selectors: {
    selectFoodSurplus: state => state,
  },
});

export const { newSurplusKey, setSurplusQuantity, setSurplusMethod, loadSurplusAsync, reserveSurplusAsync } = foodSurplusSlice.actions;
export const { selectFoodSurplus } = foodSurplusSlice.selectors;
