// MetroMatrix — Admin categories slice: the two-level tree and its edits.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { createCategory, deleteCategory, fetchAdminCategories, reorderCategories, updateCategory } from '../../networks/admin/adminShop';
import { toRejectedValue, required } from '../../networks/network/network';
import type { ShopCategory } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { categoryListSerializer, categorySerializer } from '../../serializers/shopping/catalogSerializer';

export interface CategorySheet {
  /** '' a new one; an id to rename. */
  id: string;
  parentId: string | null;
  name: string;
  icon: string;
}

export interface ShopCategoriesSliceState {
  tree: ShopCategory[];
  status: FormStatus;
  busy: boolean;
  error: ServerError;
  sheet: CategorySheet | null;
}

const initialState: ShopCategoriesSliceState = { tree: [], status: 'idle', busy: false, error: NO_ERROR, sheet: null };

type Change =
  | { kind: 'save'; sheet: CategorySheet }
  | { kind: 'delete'; id: string }
  | { kind: 'reorder'; parentId: string | null; ids: string[] };

export const shopCategoriesSlice = createAppSlice({
  name: 'shopCategories',
  initialState,
  reducers: create => ({
    openCategorySheet: create.reducer((state, action: PayloadAction<CategorySheet | null>) => {
      state.sheet = action.payload;
      state.error = NO_ERROR;
    }),
    setCategorySheet: create.reducer((state, action: PayloadAction<Partial<CategorySheet>>) => {
      if (state.sheet) state.sheet = { ...state.sheet, ...action.payload };
    }),
    loadCategoriesTreeAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await fetchAdminCategories();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
        },
        fulfilled: (state, action) => {
          const payload = categoryListSerializer(action.payload);
          state.status = 'succeeded';
          state.tree = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't load the categories.");
        },
      },
    ),
    changeCategoryAsync: create.asyncThunk(
      async (change: Change, { rejectWithValue }) => {
        try {
          if (change.kind === 'save') {
            const { id, parentId, name, icon } = change.sheet;
            await (id ? updateCategory(id, { name: name.trim(), icon }).then(raw => required(categorySerializer(raw))) : createCategory({ name: name.trim(), icon, parentId }).then(raw => required(categorySerializer(raw))));
          } else if (change.kind === 'delete') await deleteCategory(change.id);
          else await reorderCategories(change.parentId, change.ids);
          return required(categoryListSerializer(await fetchAdminCategories()));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = false;
          state.tree = action.payload;
          state.sheet = null;
        },
        rejected: (state, action) => {
          state.busy = false;
          state.error = readRejection(action, "That didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectShopCategories: state => state,
  },
});

export const { openCategorySheet, setCategorySheet, loadCategoriesTreeAsync, changeCategoryAsync } = shopCategoriesSlice.actions;
export const { selectShopCategories } = shopCategoriesSlice.selectors;
