// ═══════════════════════════════════════════════════════
// MetroMatrix — Saved slice (which products have a filled heart)
// ═══════════════════════════════════════════════════════
// Just the ids, so every product card can show its heart. A tap flips the
// heart at once and puts it back if the server refuses. The Saved screen's
// list itself pages from the server (usePagedList).

import { createAppSlice } from '@store/createAppSlice';
import { getWishlistIds, saveProduct, unsaveProduct } from '@networks/shopping/wishlistNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { FormStatus } from '../../../Auth/shared/formStatus';

export interface SavedSliceState {
  ids: string[];
  status: FormStatus;
}

const initialState: SavedSliceState = { ids: [], status: 'idle' };

const flip = (ids: string[], id: string, save: boolean) => (save ? [...ids.filter(x => x !== id), id] : ids.filter(x => x !== id));

export const savedSlice = createAppSlice({
  name: 'saved',
  initialState,
  reducers: create => ({
    loadSavedIdsAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await getWishlistIds();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.ids = action.payload;
        },
        rejected: state => {
          state.status = 'failed';
        },
      },
    ),

    setSavedAsync: create.asyncThunk(
      async ({ productId, save }: { productId: string; save: boolean }, { rejectWithValue }) => {
        try {
          if (save) await saveProduct(productId);
          else await unsaveProduct(productId);
          return true;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.ids = flip(state.ids, action.meta.arg.productId, action.meta.arg.save);
        },
        rejected: (state, action) => {
          state.ids = flip(state.ids, action.meta.arg.productId, !action.meta.arg.save);
        },
      },
    ),
  }),
  selectors: {
    selectSavedIds: state => state.ids,
    selectSavedStatus: state => state.status,
  },
});

export const { loadSavedIdsAsync, setSavedAsync } = savedSlice.actions;
export const { selectSavedIds, selectSavedStatus } = savedSlice.selectors;
