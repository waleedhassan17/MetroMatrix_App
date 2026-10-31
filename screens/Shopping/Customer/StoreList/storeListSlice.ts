// MetroMatrix — Store list slice: the search text (the list itself pages from the server).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../../store/createAppSlice';

export interface StoreListSliceState {
  query: string;
}

const initialState: StoreListSliceState = { query: '' };

export const storeListSlice = createAppSlice({
  name: 'storeList',
  initialState,
  reducers: create => ({
    setStoreQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.query = action.payload;
    }),
  }),
  selectors: {
    selectStoreQuery: state => state.query,
  },
});

export const { setStoreQuery } = storeListSlice.actions;
export const { selectStoreQuery } = storeListSlice.selectors;
