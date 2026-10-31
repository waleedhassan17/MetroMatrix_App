// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: menu categories
// ═══════════════════════════════════════════════════════
// Add, rename, give a daily window (BBQ from 6 PM), hide, reorder, delete
// (refused while it still has dishes).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { createMenuCategory, deleteMenuCategory, fetchMenuCategories, reorderMenuCategories, updateMenuCategory } from '../../networks/food/vendor/menu';
import { toRejectedValue, required } from '../../networks/network/network';
import type { CategoryForm } from '../../models/food/menuModel';
import type { MenuCategory } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { menuChanged } from '../vendor-menu-screen/vendorMenuSlice';
import { menuCategoriesSerializer } from '../../serializers/food/menuSerializer';

export interface CategorySheet {
  /** null: a new category. */
  id: string | null;
  form: CategoryForm;
  windowed: boolean;
  isActive: boolean;
}

export interface VendorCategoriesSliceState {
  categories: MenuCategory[];
  status: FormStatus;
  error: ServerError;
  sheet: CategorySheet | null;
  submitted: boolean;
  saving: boolean;
}

const initialState: VendorCategoriesSliceState = { categories: [], status: 'idle', error: NO_ERROR, sheet: null, submitted: false, saving: false };

export const vendorCategoriesSlice = createAppSlice({
  name: 'vendorCategories',
  initialState,
  reducers: create => ({
    openCategorySheet: create.reducer((state, action: PayloadAction<string | null>) => {
      const c = state.categories.find(x => x.id === action.payload);
      state.sheet = {
        id: c?.id ?? null,
        form: { name: c?.name ?? '', availableFrom: c?.availableFrom ?? '', availableTo: c?.availableTo ?? '' },
        windowed: !!c?.availableFrom,
        isActive: c?.isActive ?? true,
      };
      state.submitted = false;
      state.error = NO_ERROR;
    }),
    closeCategorySheet: create.reducer(state => {
      state.sheet = null;
    }),
    setCategoryField: create.reducer((state, action: PayloadAction<{ field: keyof CategoryForm; value: string }>) => {
      if (state.sheet) state.sheet.form[action.payload.field] = action.payload.value;
    }),
    setCategoryWindowed: create.reducer((state, action: PayloadAction<boolean>) => {
      if (!state.sheet) return;
      state.sheet.windowed = action.payload;
      if (action.payload && !state.sheet.form.availableFrom) {
        state.sheet.form.availableFrom = '18:00';
        state.sheet.form.availableTo = '23:30';
      }
    }),
    setCategoryActive: create.reducer((state, action: PayloadAction<boolean>) => {
      if (state.sheet) state.sheet.isActive = action.payload;
    }),
    markCategorySubmitted: create.reducer(state => {
      state.submitted = true;
    }),
    loadCategoriesAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(menuCategoriesSerializer(await fetchMenuCategories()));
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
          state.status = 'succeeded';
          state.categories = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your categories didn't load.");
        },
      },
    ),
    saveCategoryAsync: create.asyncThunk(
      async (sheet: CategorySheet, { dispatch, rejectWithValue }) => {
        try {
          const window = sheet.windowed
            ? { availableFrom: sheet.form.availableFrom.trim(), availableTo: sheet.form.availableTo.trim() }
            : { availableFrom: null, availableTo: null };
          if (sheet.id) await updateMenuCategory(sheet.id, { name: sheet.form.name.trim(), ...window, isActive: sheet.isActive });
          else await createMenuCategory({ name: sheet.form.name.trim(), ...window });
          dispatch(menuChanged());
          return required(menuCategoriesSerializer(await fetchMenuCategories()));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.saving = false;
          state.categories = action.payload;
          state.sheet = null;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "The category didn't save.");
        },
      },
    ),
    deleteCategoryAsync: create.asyncThunk(
      async (id: string, { dispatch, rejectWithValue }) => {
        try {
          await deleteMenuCategory(id);
          dispatch(menuChanged());
          return required(menuCategoriesSerializer(await fetchMenuCategories()));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.saving = false;
          state.categories = action.payload;
          state.sheet = null;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "The category wasn't deleted.");
        },
      },
    ),
    /** Move one place up or down; the whole order is sent. */
    moveCategoryAsync: create.asyncThunk(
      async ({ id, by }: { id: string; by: -1 | 1 }, { getState, dispatch, rejectWithValue }) => {
        const list = (getState() as { vendorCategories: VendorCategoriesSliceState }).vendorCategories.categories.map(c => c.id);
        const i = list.indexOf(id);
        const j = i + by;
        if (i < 0 || j < 0 || j >= list.length) return null;
        [list[i], list[j]] = [list[j], list[i]];
        try {
          const out = required(menuCategoriesSerializer(await reorderMenuCategories(list)));
          dispatch(menuChanged());
          return out;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const { id, by } = action.meta.arg;
          const i = state.categories.findIndex(c => c.id === id);
          const j = i + by;
          if (i >= 0 && j >= 0 && j < state.categories.length) [state.categories[i], state.categories[j]] = [state.categories[j], state.categories[i]];
        },
        fulfilled: (state, action) => {
          if (action.payload) state.categories = action.payload;
        },
        rejected: (state, action) => {
          state.error = readRejection(action, "The order didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorCategories: state => state,
  },
});

export const {
  openCategorySheet,
  closeCategorySheet,
  setCategoryField,
  setCategoryWindowed,
  setCategoryActive,
  markCategorySubmitted,
  loadCategoriesAsync,
  saveCategoryAsync,
  deleteCategoryAsync,
  moveCategoryAsync,
} = vendorCategoriesSlice.actions;
export const { selectVendorCategories } = vendorCategoriesSlice.selectors;
