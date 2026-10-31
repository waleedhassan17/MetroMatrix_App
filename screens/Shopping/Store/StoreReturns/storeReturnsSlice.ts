// MetroMatrix — Store returns slice: open ones, or every return.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../../store/createAppSlice';

export interface StoreReturnsSliceState {
  openOnly: boolean;
}

const initialState: StoreReturnsSliceState = { openOnly: true };

export const storeReturnsSlice = createAppSlice({
  name: 'storeReturns',
  initialState,
  reducers: create => ({
    setReturnsOpenOnly: create.reducer((state, action: PayloadAction<boolean>) => {
      state.openOnly = action.payload;
    }),
  }),
  selectors: {
    selectStoreReturns: state => state,
  },
});

export const { setReturnsOpenOnly } = storeReturnsSlice.actions;
export const { selectStoreReturns } = storeReturnsSlice.selectors;
