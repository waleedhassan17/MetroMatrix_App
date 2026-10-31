// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: a Bachat Box (customer)
// ═══════════════════════════════════════════════════════
// One box: what it is worth and costs, the pickup window and place, how
// many are left. Reserving takes an Idempotency-Key — one per attempt,
// kept for its retries, so a retry never reserves twice — and answers
// "someone just reserved the last one" plainly (409 SURPLUS_SOLD_OUT).
// TODO(API_KITCHEN): docs/API_KITCHEN_ASSUMED.md §4.4.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchSurplus, reserveSurplus } from '../../networks/food/surplus';
import { toRejectedValue } from '../../networks/network/network';
import { newUuid } from '../../utils/ids/ids';
import type { BoxPaymentMethod, FoodPoint, SurplusDetail } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { surplusDetailSerializer, reservationSerializer } from '../../serializers/kitchen/surplusSerializer';

export interface FoodSurplusSliceState {
  box: SurplusDetail | null;
  status: FormStatus;
  error: ServerError;
  quantity: number;
  method: BoxPaymentMethod;
  idempotencyKey: string;
  reserving: boolean;
  reserveError: ServerError;
  /** The reservation just made. */
  reserved: ReturnType<typeof reservationSerializer>;
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
  reserved: null,
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
          return await fetchSurplus(id, at);
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
          const payload = surplusDetailSerializer(action.payload);
          state.status = 'succeeded';
          state.box = payload;
          if (payload) {
            state.quantity = Math.max(1, Math.min(state.quantity, payload.maxPerCustomer, payload.left || 1));
            if (!payload.paymentMethods.includes(state.method)) state.method = payload.paymentMethods[0] ?? 'pay_at_pickup';
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
          const reserved = await reserveSurplus(s.box.id, { quantity: s.quantity, paymentMethod: s.method }, s.idempotencyKey || newUuid());
          dispatch(newSurplusKey());
          return reserved;
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
        fulfilled: (state, action) => {
          const payload = reservationSerializer(action.payload);
          state.reserving = false;
          state.reserved = payload;
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
