// MetroMatrix — Orders tab slice: which service, which Shop segment and which
// Health list (Upcoming / Past) are showing.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { AppointmentSegment, OrderSegment } from '@/types';

export type OrdersService = 'shop' | 'health' | 'food';

export interface OrdersSliceState {
  service: OrdersService;
  segment: OrderSegment;
  visits: AppointmentSegment;
}

const initialState: OrdersSliceState = { service: 'shop', segment: 'active', visits: 'upcoming' };

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
    setVisitsSegment: create.reducer((state, action: PayloadAction<AppointmentSegment>) => {
      state.visits = action.payload;
    }),
  }),
  selectors: {
    selectOrdersView: state => state,
  },
});

export const { setOrdersService, setOrdersSegment, setVisitsSegment } = ordersSlice.actions;
export const { selectOrdersView } = ordersSlice.selectors;
