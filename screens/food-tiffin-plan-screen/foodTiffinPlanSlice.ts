// MetroMatrix — Food Court: a tiffin plan, and asking to join it. The
// request takes an Idempotency-Key (one per attempt, kept for its retries)
// and starts pending until the kitchen approves.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchTiffinPlan, subscribeTiffin } from '../../networks/foodGrowth/tiffin';
import { toRejectedValue, required } from '../../networks/network/network';
import { newUuid } from '../../utils/ids/ids';
import type { TiffinPayMethod, TiffinPlan } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { tiffinPlanSerializer, tiffinSubscriptionSerializer } from '../../serializers/kitchen/growthSerializer';

export interface FoodTiffinPlanSliceState {
  plan: TiffinPlan | null;
  status: FormStatus;
  error: ServerError;
  startDate: string | null;
  addressId: string | null;
  payMethod: TiffinPayMethod;
  idempotencyKey: string;
  subscribing: boolean;
  subscribeError: ServerError;
}

const initialState: FoodTiffinPlanSliceState = {
  plan: null,
  status: 'idle',
  error: NO_ERROR,
  startDate: null,
  addressId: null,
  payMethod: 'transfer',
  idempotencyKey: '',
  subscribing: false,
  subscribeError: NO_ERROR,
};

export const foodTiffinPlanSlice = createAppSlice({
  name: 'foodTiffinPlan',
  initialState,
  reducers: create => ({
    newTiffinKey: create.preparedReducer(
      () => ({ payload: newUuid() }),
      (state, action: PayloadAction<string>) => {
        state.idempotencyKey = action.payload;
      },
    ),
    chooseTiffin: create.reducer((state, action: PayloadAction<Partial<Pick<FoodTiffinPlanSliceState, 'startDate' | 'addressId' | 'payMethod'>>>) => {
      Object.assign(state, action.payload);
      state.subscribeError = NO_ERROR;
    }),
    loadTiffinPlanAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return required(tiffinPlanSerializer(await fetchTiffinPlan(id)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          if (state.plan?.id !== action.meta.arg) {
            state.plan = null;
            state.startDate = null;
            state.subscribeError = NO_ERROR;
          }
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.plan = action.payload;
          if (action.payload && (!state.startDate || state.startDate < (action.payload.nextStart ?? ''))) state.startDate = action.payload.nextStart;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "This plan didn't load.");
        },
      },
    ),
    subscribeTiffinAsync: create.asyncThunk(
      async (_: void, { getState, dispatch, rejectWithValue }) => {
        const s = (getState() as { foodTiffinPlan: FoodTiffinPlanSliceState }).foodTiffinPlan;
        if (!s.plan || !s.startDate) return rejectWithValue({ message: 'Pick a day to start.', code: 'VALIDATION_FAILED', status: 400, details: null });
        try {
          const out = required(tiffinSubscriptionSerializer(await subscribeTiffin(s.plan.id, { startDate: s.startDate, addressId: s.plan.mode === 'delivery' ? s.addressId : null, paymentMethod: s.payMethod }, s.idempotencyKey || newUuid())));
          dispatch(newTiffinKey());
          return out;
        } catch (e) {
          const err = toRejectedValue(e);
          if (err.status) dispatch(newTiffinKey());
          return rejectWithValue(err);
        }
      },
      {
        pending: state => {
          state.subscribing = true;
          state.subscribeError = NO_ERROR;
        },
        fulfilled: state => {
          state.subscribing = false;
        },
        rejected: (state, action) => {
          state.subscribing = false;
          state.subscribeError = readRejection(action, "We couldn't send your request. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectFoodTiffinPlan: state => state,
  },
});

export const { newTiffinKey, chooseTiffin, loadTiffinPlanAsync, subscribeTiffinAsync } = foodTiffinPlanSlice.actions;
export const { selectFoodTiffinPlan } = foodTiffinPlanSlice.selectors;
