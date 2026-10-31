// ═══════════════════════════════════════════════════════
// MetroMatrix — Store page slice (keyed by store, so pages can stack)
// ═══════════════════════════════════════════════════════

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchStore } from '../../networks/shopping/catalog';
import { toRejectedValue } from '../../networks/network/network';
import type { ProductSort, StoreDetail } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { storeDetailSerializer } from '../../serializers/shopping/catalogSerializer';

export interface StorePageEntry {
  store: StoreDetail | null;
  status: FormStatus;
  error: ServerError;
  collectionId: string | null;
  sort: ProductSort;
}

export interface StorePageSliceState {
  bySlug: Record<string, StorePageEntry>;
}

const blank = (): StorePageEntry => ({ store: null, status: 'idle', error: NO_ERROR, collectionId: null, sort: 'relevance' });

const initialState: StorePageSliceState = { bySlug: {} };

export const storePageSlice = createAppSlice({
  name: 'storePage',
  initialState,
  reducers: create => ({
    setStoreCollection: create.reducer((state, action: PayloadAction<{ slug: string; collectionId: string | null }>) => {
      const e = (state.bySlug[action.payload.slug] ??= blank());
      e.collectionId = action.payload.collectionId;
    }),
    setStoreSort: create.reducer((state, action: PayloadAction<{ slug: string; sort: ProductSort }>) => {
      const e = (state.bySlug[action.payload.slug] ??= blank());
      e.sort = action.payload.sort;
    }),
    loadStoreAsync: create.asyncThunk(
      async (slug: string, { rejectWithValue }) => {
        try {
          return await fetchStore(slug);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const e = (state.bySlug[action.meta.arg] ??= blank());
          e.status = 'loading';
          e.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = storeDetailSerializer(action.payload);
          const e = (state.bySlug[action.meta.arg] ??= blank());
          e.status = 'succeeded';
          e.store = payload;
        },
        rejected: (state, action) => {
          const e = (state.bySlug[action.meta.arg] ??= blank());
          e.status = 'failed';
          e.error = readRejection(action, "We couldn't open this store.");
        },
      },
    ),
  }),
  selectors: {
    selectStorePage: (state, slug: string): StorePageEntry => state.bySlug[slug] ?? EMPTY,
  },
});

const EMPTY: StorePageEntry = blank();

export const { setStoreCollection, setStoreSort, loadStoreAsync } = storePageSlice.actions;
export const { selectStorePage } = storePageSlice.selectors;
