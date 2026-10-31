// MetroMatrix — Store products slice: which shelf (live, drafts, hidden) and the search.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../../store/createAppSlice';
import type { PartnerProductStatus } from '../../../../types';

export interface StoreProductsSliceState {
  status: PartnerProductStatus;
  query: string;
}

const initialState: StoreProductsSliceState = { status: 'active', query: '' };

export const storeProductsSlice = createAppSlice({
  name: 'storeProducts',
  initialState,
  reducers: create => ({
    setProductsShelf: create.reducer((state, action: PayloadAction<PartnerProductStatus>) => {
      state.status = action.payload;
    }),
    setProductsQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.query = action.payload;
    }),
  }),
  selectors: {
    selectStoreProducts: state => state,
  },
});

export const { setProductsShelf, setProductsQuery } = storeProductsSlice.actions;
export const { selectStoreProducts } = storeProductsSlice.selectors;
