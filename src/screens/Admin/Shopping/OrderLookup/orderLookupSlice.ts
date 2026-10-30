// MetroMatrix — Admin order lookup slice.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { lookupOrderAPI } from '@networks/admin/adminShopNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { AdminOrderLookup } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { orderLookupSerializer } from '@serializers/shopping/adminShopSerializer';

export interface OrderLookupSliceState {
  code: string;
  result: AdminOrderLookup | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: OrderLookupSliceState = { code: '', result: null, status: 'idle', error: NO_ERROR };

export const orderLookupSlice = createAppSlice({
  name: 'orderLookup',
  initialState,
  reducers: create => ({
    setLookupCode: create.reducer((state, action: PayloadAction<string>) => {
      state.code = action.payload.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
    }),
    lookupOrderAsync: create.asyncThunk(
      async (code: string, { rejectWithValue }) => {
        try {
          return required(orderLookupSerializer(await lookupOrderAPI(code)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = NO_ERROR;
          state.result = null;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.result = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, 'No order with that code.');
        },
      },
    ),
  }),
  selectors: {
    selectOrderLookup: state => state,
  },
});

export const { setLookupCode, lookupOrderAsync } = orderLookupSlice.actions;
export const { selectOrderLookup } = orderLookupSlice.selectors;
