// MetroMatrix — Category browse slice: the category tree and the chosen top level.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchCategories } from '../../networks/shopping/catalog';
import { toRejectedValue } from '../../networks/network/network';
import type { ShopCategory } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { categoryListSerializer } from '../../serializers/shopping/catalogSerializer';

export interface CategoryBrowseSliceState {
  categories: ShopCategory[];
  status: FormStatus;
  error: ServerError;
  selectedId: string | null;
}

const initialState: CategoryBrowseSliceState = { categories: [], status: 'idle', error: NO_ERROR, selectedId: null };

export const categoryBrowseSlice = createAppSlice({
  name: 'categoryBrowse',
  initialState,
  reducers: create => ({
    selectTopCategory: create.reducer((state, action: PayloadAction<string>) => {
      state.selectedId = action.payload;
    }),
    loadCategoriesAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await fetchCategories();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = categoryListSerializer(action.payload);
          state.status = 'succeeded';
          state.categories = payload;
          if (!state.selectedId || !payload.some(c => c.id === state.selectedId)) state.selectedId = payload[0]?.id ?? null;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't load the categories.");
        },
      },
    ),
  }),
  selectors: {
    selectCategoryBrowse: state => state,
  },
});

export const { selectTopCategory, loadCategoriesAsync } = categoryBrowseSlice.actions;
export const { selectCategoryBrowse } = categoryBrowseSlice.selectors;

/** The top-level category that is (or contains) `id`. */
export const topLevelOf = (categories: ShopCategory[], id: string | undefined): string | null => {
  if (!id) return null;
  const top = categories.find(c => c.id === id || c.children.some(x => x.id === id));
  return top?.id ?? null;
};
