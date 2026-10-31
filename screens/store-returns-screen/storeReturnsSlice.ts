// MetroMatrix — Store returns slice: the returns in one state (new, on the way
// back, to refund), or every return.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import type { ReturnStatus } from '../../models';

export type StoreReturnsView = Extract<ReturnStatus, 'requested' | 'approved' | 'received'> | 'all';

export interface StoreReturnsSliceState {
  view: StoreReturnsView;
}

const initialState: StoreReturnsSliceState = { view: 'requested' };

export const storeReturnsSlice = createAppSlice({
  name: 'storeReturns',
  initialState,
  reducers: create => ({
    setReturnsView: create.reducer((state, action: PayloadAction<StoreReturnsView>) => {
      state.view = action.payload;
    }),
  }),
  selectors: {
    selectStoreReturns: state => state,
  },
});

export const { setReturnsView } = storeReturnsSlice.actions;
export const { selectStoreReturns } = storeReturnsSlice.selectors;
