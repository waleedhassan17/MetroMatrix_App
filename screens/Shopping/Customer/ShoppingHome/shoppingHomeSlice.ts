// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping home slice (the brand list, as in the FYP)
// ═══════════════════════════════════════════════════════
// GET /shop/home for the banners and the featured brands; the brand search
// text. "All brands" pages from the server (usePagedList on /shop/stores).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../../store/createAppSlice';
import { getShopHomeAPI } from '../../../../networks/shopping/catalogNetwork';
import { toRejectedValue, required } from '../../../../networks/network/apiHelpers';
import type { ShopHome } from '../../../../types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { shopHomeSerializer } from '../../../../serializers/shopping/catalogSerializer';

export interface ShoppingHomeSliceState {
  home: ShopHome | null;
  status: FormStatus;
  refreshing: boolean;
  error: ServerError;
  /** "Search brands" — filters the list on the server. */
  brandQuery: string;
}

const initialState: ShoppingHomeSliceState = {
  home: null,
  status: 'idle',
  refreshing: false,
  error: NO_ERROR,
  brandQuery: '',
};

export const shoppingHomeSlice = createAppSlice({
  name: 'shoppingHome',
  initialState,
  reducers: create => ({
    setBrandQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.brandQuery = action.payload;
    }),
    loadShoppingHomeAsync: create.asyncThunk(
      async (_: { refresh: boolean }, { rejectWithValue }) => {
        try {
          return required(shopHomeSerializer(await getShopHomeAPI()));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.status = 'loading';
          state.refreshing = action.meta.arg.refresh;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.refreshing = false;
          state.home = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.refreshing = false;
          state.error = readRejection(action, "We couldn't load the shops.");
        },
      },
    ),
  }),
  selectors: {
    selectShoppingHome: state => state,
  },
});

export const { setBrandQuery, loadShoppingHomeAsync } = shoppingHomeSlice.actions;
export const { selectShoppingHome } = shoppingHomeSlice.selectors;
