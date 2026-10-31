// MetroMatrix — Store orders slice: the segment (or "payments to check") and the search.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import type { PartnerOrderSegment } from '../../models';

export type StoreOrdersView = PartnerOrderSegment | 'payments';

export interface StoreOrdersSliceState {
  view: StoreOrdersView;
  query: string;
}

const initialState: StoreOrdersSliceState = { view: 'new', query: '' };

export const storeOrdersSlice = createAppSlice({
  name: 'storeOrders',
  initialState,
  reducers: create => ({
    setStoreOrdersView: create.reducer((state, action: PayloadAction<StoreOrdersView>) => {
      state.view = action.payload;
    }),
    setStoreOrdersQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.query = action.payload;
    }),
  }),
  selectors: {
    selectStoreOrders: state => state,
  },
});

export const { setStoreOrdersView, setStoreOrdersQuery } = storeOrdersSlice.actions;
export const { selectStoreOrders } = storeOrdersSlice.selectors;
