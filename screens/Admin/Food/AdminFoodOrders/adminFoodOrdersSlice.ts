// MetroMatrix — Admin Food orders slice: the code typed, and the vendor and
// status the list is narrowed to.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../../store/createAppSlice';
import type { FoodOrderStatus } from '../../../../types';

export interface AdminFoodOrdersSliceState {
  code: string;
  vendor: { id: string; name: string | null } | null;
  status: FoodOrderStatus | null;
}

const initialState: AdminFoodOrdersSliceState = { code: '', vendor: null, status: null };

export const adminFoodOrdersSlice = createAppSlice({
  name: 'adminFoodOrders',
  initialState,
  reducers: create => ({
    setFoodOrderCode: create.reducer((state, action: PayloadAction<string>) => {
      state.code = action.payload
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, '')
        .slice(0, 16);
    }),
    setFoodOrdersVendor: create.reducer(
      (state, action: PayloadAction<{ id: string; name: string | null } | null>) => {
        state.vendor = action.payload;
      },
    ),
    setFoodOrdersStatus: create.reducer((state, action: PayloadAction<FoodOrderStatus | null>) => {
      state.status = action.payload;
    }),
  }),
  selectors: {
    selectAdminFoodOrders: state => state,
  },
});

export const { setFoodOrderCode, setFoodOrdersVendor, setFoodOrdersStatus } =
  adminFoodOrdersSlice.actions;
export const { selectAdminFoodOrders } = adminFoodOrdersSlice.selectors;
