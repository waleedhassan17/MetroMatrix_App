// MetroMatrix — Coupons slice: the store's codes (the form edits one).

import { createAppSlice } from '@store/createAppSlice';
import { listCoupons } from '@networks/shopping/partner/couponsNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { Coupon } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export interface CouponsSliceState {
  coupons: Coupon[];
  status: FormStatus;
  error: ServerError;
}

const initialState: CouponsSliceState = { coupons: [], status: 'idle', error: NO_ERROR };

export const couponsSlice = createAppSlice({
  name: 'coupons',
  initialState,
  reducers: create => ({
    loadCouponsListAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await listCoupons();
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
          state.coupons = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't load your coupons.");
        },
      },
    ),
  }),
  selectors: {
    selectCoupons: state => state,
  },
});

export const { loadCouponsListAsync } = couponsSlice.actions;
export const { selectCoupons } = couponsSlice.selectors;
