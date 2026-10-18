// MetroMatrix — Admin Food vendors slice: the search and the filters.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { AdminVendorStatus, KitchenKind } from '@/types';

export interface AdminFoodVendorsSliceState {
  query: string;
  type: KitchenKind | null;
  status: AdminVendorStatus | null;
}

const initialState: AdminFoodVendorsSliceState = { query: '', type: null, status: null };

export const adminFoodVendorsSlice = createAppSlice({
  name: 'adminFoodVendors',
  initialState,
  reducers: create => ({
    setFoodVendorsQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.query = action.payload.slice(0, 80);
    }),
    setFoodVendorsType: create.reducer((state, action: PayloadAction<KitchenKind | null>) => {
      state.type = action.payload;
    }),
    setFoodVendorsStatus: create.reducer((state, action: PayloadAction<AdminVendorStatus | null>) => {
      state.status = action.payload;
    }),
  }),
  selectors: {
    selectAdminFoodVendors: state => state,
  },
});

export const { setFoodVendorsQuery, setFoodVendorsType, setFoodVendorsStatus } = adminFoodVendorsSlice.actions;
export const { selectAdminFoodVendors } = adminFoodVendorsSlice.selectors;
