// ═══════════════════════════════════════════════════════
// MetroMatrix — Product list slice (filters, per list)
// ═══════════════════════════════════════════════════════
// Each list (a category, a collection, a search) keeps its own applied
// filters and the draft being edited in the sheet, with the server's count
// for that draft ("Show 24 results"). The products page via usePagedList.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { getProductsAPI } from '../../networks/shopping/catalogNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import { DEFAULT_FILTERS, type ProductFilters } from '../../models/shopping/filterModel';
import type { ProductQuery } from '../../models';
import { productSummaryPageSerializer } from '../../serializers/shopping/catalogSerializer';

export interface ProductListEntry {
  filters: ProductFilters;
  draft: ProductFilters;
  /** Matches for the draft; null while counting. */
  draftCount: number | null;
  sheetOpen: boolean;
}

export interface ProductListSliceState {
  byKey: Record<string, ProductListEntry>;
}

const entry = (initial: ProductFilters): ProductListEntry => ({ filters: initial, draft: initial, draftCount: null, sheetOpen: false });

const initialState: ProductListSliceState = { byKey: {} };

export const productListSlice = createAppSlice({
  name: 'productList',
  initialState,
  reducers: create => ({
    /** First visit to a list: its starting filters (a "Popular" list sorts by trending). */
    initList: create.reducer((state, action: PayloadAction<{ key: string; initial: ProductFilters }>) => {
      state.byKey[action.payload.key] ??= entry(action.payload.initial);
    }),
    openFilters: create.reducer((state, action: PayloadAction<string>) => {
      const e = state.byKey[action.payload];
      if (!e) return;
      e.draft = e.filters;
      e.draftCount = null;
      e.sheetOpen = true;
    }),
    closeFilters: create.reducer((state, action: PayloadAction<string>) => {
      const e = state.byKey[action.payload];
      if (e) e.sheetOpen = false;
    }),
    setDraft: create.reducer((state, action: PayloadAction<{ key: string; draft: ProductFilters }>) => {
      const e = state.byKey[action.payload.key];
      if (!e) return;
      e.draft = action.payload.draft;
      e.draftCount = null;
    }),
    resetDraft: create.reducer((state, action: PayloadAction<string>) => {
      const e = state.byKey[action.payload];
      if (!e) return;
      e.draft = { ...DEFAULT_FILTERS, sort: e.draft.sort };
      e.draftCount = null;
    }),
    applyFilters: create.reducer((state, action: PayloadAction<string>) => {
      const e = state.byKey[action.payload];
      if (!e) return;
      e.filters = e.draft;
      e.sheetOpen = false;
    }),
    /** Remove one applied filter from its chip. */
    setFilters: create.reducer((state, action: PayloadAction<{ key: string; filters: ProductFilters }>) => {
      const e = state.byKey[action.payload.key];
      if (e) e.filters = action.payload.filters;
    }),

    countDraftAsync: create.asyncThunk(
      async ({ query }: { key: string; query: ProductQuery }, { rejectWithValue }) => {
        try {
          // How many match: one row is enough to read the total.
          return required(productSummaryPageSerializer(await getProductsAPI(query, 1, 1))).total;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          const e = state.byKey[action.meta.arg.key];
          if (e) e.draftCount = action.payload;
        },
      },
    ),
  }),
  selectors: {
    selectProductList: (state, key: string): ProductListEntry | null => state.byKey[key] ?? null,
  },
});

export const { initList, openFilters, closeFilters, setDraft, resetDraft, applyFilters, setFilters, countDraftAsync } =
  productListSlice.actions;
export const { selectProductList } = productListSlice.selectors;
