// MetroMatrix — Admin stores slice: search, and which store a toggle is saving.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../../store/createAppSlice';
import { setStoreFeaturedAPI } from '../../../../networks/admin/adminShopNetwork';
import { toRejectedValue, required } from '../../../../networks/network/apiHelpers';
import { NO_ERROR, readRejection, type ServerError } from '../../../Auth/shared/formStatus';
import { storeSummarySerializer } from '../../../../serializers/shopping/catalogSerializer';

export interface ShopStoresSliceState {
  query: string;
  busy: string | null;
  error: ServerError;
}

const initialState: ShopStoresSliceState = { query: '', busy: null, error: NO_ERROR };

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
          return required(storeSummarySerializer(await setStoreFeaturedAPI(id, featured)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busy = action.meta.arg.id;
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.busy = null;
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
