// MetroMatrix — Orders tab slice: which service and which Shop segment are showing.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { OrderSegment } from '@/types';

export type OrdersService = 'shop' | 'health' | 'food';

export interface OrdersSliceState {
  service: OrdersService;
  segment: OrderSegment;
}

const initialState: OrdersSliceState = { service: 'shop', segment: 'active' };

export const ordersSlice = createAppSlice({
  name: 'orders',
  initialState,
  reducers: create => ({
    setOrdersService: create.reducer((state, action: PayloadAction<OrdersService>) => {
      state.service = action.payload;
    }),
    setOrdersSegment: create.reducer((state, action: PayloadAction<OrderSegment>) => {
      state.segment = action.payload;
    }),
  }),
  selectors: {
    selectOrdersView: state => state,
  },
});

export const { setOrdersService, setOrdersSegment } = ordersSlice.actions;
export const { selectOrdersView } = ordersSlice.selectors;
