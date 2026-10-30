// MetroMatrix — Admin categories slice: the two-level tree and its edits.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { createCategoryAPI, deleteCategoryAPI, getAdminCategoriesAPI, reorderCategoriesAPI, updateCategoryAPI } from '@networks/admin/adminShopNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { ShopCategory } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { categoryListSerializer, categorySerializer } from '@serializers/shopping/catalogSerializer';

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
          return required(categoryListSerializer(await getAdminCategoriesAPI()));
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
          state.tree = action.payload;
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
            await (id ? updateCategoryAPI(id, { name: name.trim(), icon }).then(raw => required(categorySerializer(raw))) : createCategoryAPI({ name: name.trim(), icon, parentId }).then(raw => required(categorySerializer(raw))));
          } else if (change.kind === 'delete') await deleteCategoryAPI(change.id);
          else await reorderCategoriesAPI(change.parentId, change.ids);
          return required(categoryListSerializer(await getAdminCategoriesAPI()));
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
