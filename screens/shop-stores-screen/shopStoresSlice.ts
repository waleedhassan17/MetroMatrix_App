// MetroMatrix — Admin stores slice: search, and which store a toggle is saving.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { setStoreFeatured } from '../../networks/admin/adminShop';
import { toRejectedValue } from '../../networks/network/network';
import { NO_ERROR, readRejection, type ServerError } from '../shared/formStatus';
import { storeSummarySerializer } from '../../serializers/shopping/catalogSerializer';

export interface ShopStoresSliceState {
  query: string;
  busy: string | null;
  error: ServerError;
  /** The store just featured or unfeatured, as the server has it now. */
  updated: ReturnType<typeof storeSummarySerializer>;
}

const initialState: ShopStoresSliceState = { query: '', busy: null, error: NO_ERROR ,
  updated: null,
};

export const shopStoresSlice = createAppSlice({
  name: 'shopStores',
  initialState,
  reducers: create => ({
    setStoresQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.query = action.payload;
    }),
    setFeaturedAsync: create.asyncThunk(
      async ({ id, featured }: { id: string; featured: boolean }, { rejectWithValue }) => {
        try {
          return await setStoreFeatured(id, featured);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busy = action.meta.arg.id;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = storeSummarySerializer(action.payload);
          state.busy = null;
          state.updated = payload;
        },
        rejected: (state, action) => {
          state.busy = null;
          state.error = readRejection(action, "That didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectShopStores: state => state,
  },
});

export const { setStoresQuery, setFeaturedAsync } = shopStoresSlice.actions;
export const { selectShopStores } = shopStoresSlice.selectors;
