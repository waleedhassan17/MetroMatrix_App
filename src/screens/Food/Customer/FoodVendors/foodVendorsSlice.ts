// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: a list of vendors
// ═══════════════════════════════════════════════════════
// A cuisine, a home rail's "See all", or pick-up places: the sort and the
// filter chips live here; the rows are paged by the screen (usePagedList).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { VendorFilter } from '@models/food/discoveryModel';
import type { VendorSort } from '@/types';

export interface FoodVendorsSliceState {
  sort: VendorSort;
  filters: VendorFilter[];
}

const initialState: FoodVendorsSliceState = { sort: 'recommended', filters: [] };

export const foodVendorsSlice = createAppSlice({
  name: 'foodVendors',
  initialState,
  reducers: create => ({
    /** A list opens on its preset (a rail's sort and filters). */
    startVendorList: create.reducer((state, action: PayloadAction<FoodVendorsSliceState>) => {
      state.sort = action.payload.sort;
      state.filters = action.payload.filters;
    }),
    setVendorSort: create.reducer((state, action: PayloadAction<VendorSort>) => {
      state.sort = action.payload;
    }),
    toggleVendorFilter: create.reducer((state, action: PayloadAction<VendorFilter>) => {
      const f = action.payload;
      state.filters = state.filters.includes(f) ? state.filters.filter(x => x !== f) : [...state.filters, f];
    }),
  }),
  selectors: {
    selectFoodVendors: state => state,
  },
});

export const { startVendorList, setVendorSort, toggleVendorFilter } = foodVendorsSlice.actions;
export const { selectFoodVendors } = foodVendorsSlice.selectors;
