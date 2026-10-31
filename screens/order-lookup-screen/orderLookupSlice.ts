// MetroMatrix — Admin order lookup slice: a code finds its store orders (the
// API matches by prefix), then each one opens with its items and timeline.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchAdminOrder, fetchAdminOrders } from '../../networks/admin/adminShop';
import { required, toRejectedValue } from '../../networks/network/network';
import type { AdminOrderLookup } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { lookupRowsSerializer, orderLookupSerializer } from '../../serializers/shopping/adminShopSerializer';

export interface OrderLookupSliceState {
  code: string;
  result: AdminOrderLookup | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: OrderLookupSliceState = { code: '', result: null, status: 'idle', error: NO_ERROR };

const NOT_FOUND: ServerError = { message: 'No order with that code.', code: 'NOT_FOUND', details: null };

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
          const rows = await fetchAdminOrders({ code: code.trim().toUpperCase() }, 1, 20);
          const details = await Promise.all(required(lookupRowsSerializer(rows, code)).map(r => fetchAdminOrder(String(r.id))));
          return { rows, details };
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
          const payload = orderLookupSerializer(action.payload, action.meta.arg);
          state.status = payload ? 'succeeded' : 'failed';
          state.error = payload ? NO_ERROR : NOT_FOUND;
          state.result = payload;
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
