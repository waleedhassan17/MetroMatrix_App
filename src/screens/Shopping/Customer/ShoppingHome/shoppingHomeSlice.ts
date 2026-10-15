// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping home slice
// ═══════════════════════════════════════════════════════
// GET /shop/home (banners, categories, featured stores, new this week) and
// the first trending products, together, so the page fills in one go.

import { createAppSlice } from '@store/createAppSlice';
import { getShopHome, listProducts } from '@networks/shopping/catalogNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { ProductSummary, ShopHome } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

/** Trending products shown on the home before "See all". */
export const HOME_TRENDING = 6;

export interface ShoppingHomeSliceState {
  home: ShopHome | null;
  trending: ProductSummary[];
  status: FormStatus;
  refreshing: boolean;
  error: ServerError;
}

const initialState: ShoppingHomeSliceState = {
  home: null,
  trending: [],
  status: 'idle',
  refreshing: false,
  error: NO_ERROR,
};

export const shoppingHomeSlice = createAppSlice({
  name: 'shoppingHome',
  initialState,
  reducers: create => ({
    loadShoppingHomeAsync: create.asyncThunk(
      async (_: { refresh: boolean }, { rejectWithValue }) => {
        try {
          const [home, trending] = await Promise.all([getShopHome(), listProducts({ sort: 'trending' }, 1, HOME_TRENDING)]);
          return { home, trending: trending.items };
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
          state.home = action.payload.home;
          state.trending = action.payload.trending;
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

export const { loadShoppingHomeAsync } = shoppingHomeSlice.actions;
export const { selectShoppingHome } = shoppingHomeSlice.selectors;
