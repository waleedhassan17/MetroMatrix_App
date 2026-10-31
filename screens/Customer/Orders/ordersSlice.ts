// MetroMatrix — Orders tab slice: which service, which Shop segment, which
// Health list (Upcoming / Past) and which Food list (Active / Past) are showing.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../store/createAppSlice';
import type { AppointmentSegment, OrderSegment } from '../../../types';

export type OrdersService = 'shop' | 'health' | 'food';
export type FoodOrderSegment = 'active' | 'past';

export interface OrdersSliceState {
  service: OrdersService;
  segment: OrderSegment;
  visits: AppointmentSegment;
  food: FoodOrderSegment;
}

const initialState: OrdersSliceState = { service: 'shop', segment: 'active', visits: 'upcoming', food: 'active' };

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
    setFoodSegment: create.reducer((state, action: PayloadAction<FoodOrderSegment>) => {
      state.food = action.payload;
    }),
  }),
  selectors: {
    selectOrdersView: state => state,
  },
});

export const { setOrdersService, setOrdersSegment, setVisitsSegment, setFoodSegment } = ordersSlice.actions;
export const { selectOrdersView } = ordersSlice.selectors;
