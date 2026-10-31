// MetroMatrix — Kitchen: nutrition. Each dish's calories and macros (from its
// recipe card, or estimated), hiding a dish's numbers, and matching the
// ingredients that have no nutrition food yet.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchVendorNutrition, searchNutritionFoods, setNutritionHidden } from '../../networks/kitchen/nutrition';
import { toRejectedValue, required } from '../../networks/network/network';
import type { NutritionFood, VendorNutrition } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { vendorNutritionSerializer, dishNutritionSerializer, nutritionFoodsSerializer } from '../../serializers/kitchen/assistantSerializer';
import { updateIngredient } from '../../networks/kitchen/stock';

export interface NutritionVendorSliceState {
  data: VendorNutrition | null;
  status: FormStatus;
  error: ServerError;
  toggling: string | null;
  mapping: string | null;
  actionError: ServerError;
  /** The food search for one ingredient. */
  searchFor: string | null;
  query: string;
  foods: NutritionFood[];
  searching: boolean;
}

const initialState: NutritionVendorSliceState = {
  data: null,
  status: 'idle',
  error: NO_ERROR,
  toggling: null,
  mapping: null,
  actionError: NO_ERROR,
  searchFor: null,
  query: '',
  foods: [],
  searching: false,
};

export const nutritionVendorSlice = createAppSlice({
  name: 'nutritionVendor',
  initialState,
  reducers: create => ({
    openFoodSearch: create.reducer((state, action: PayloadAction<{ ingredientId: string; query: string } | null>) => {
      state.searchFor = action.payload?.ingredientId ?? null;
      state.query = action.payload?.query ?? '';
      state.foods = [];
    }),
    setFoodQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.query = action.payload;
    }),
    loadVendorNutritionAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await fetchVendorNutrition();
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
          const payload = vendorNutritionSerializer(action.payload);
          state.status = 'succeeded';
          state.data = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Nutrition didn't load.");
        },
      },
    ),
    setNutritionHiddenAsync: create.asyncThunk(
      async ({ itemId, hidden }: { itemId: string; hidden: boolean }, { rejectWithValue }) => {
        try {
          return await setNutritionHidden(itemId, hidden);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.toggling = action.meta.arg.itemId;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = dishNutritionSerializer(action.payload);
          state.toggling = null;
          if (!payload) return;
          if (state.data) {
            state.data.items = state.data.items.map(i => (i.itemId === payload.itemId ? payload : i));
            state.data.counts.hidden = state.data.items.filter(i => i.hidden).length;
          }
        },
        rejected: (state, action) => {
          state.toggling = null;
          state.actionError = readRejection(action, "That didn't save.");
        },
      },
    ),
    /** Matching an ingredient changes every dish it is in: read them all again. */
    mapIngredientAsync: create.asyncThunk(
      async ({ ingredientId, foodId }: { ingredientId: string; foodId: string }, { rejectWithValue }) => {
        try {
          await updateIngredient(ingredientId, { nutritionFoodId: foodId });
          return await fetchVendorNutrition();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.mapping = action.meta.arg.ingredientId;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = vendorNutritionSerializer(action.payload);
          state.mapping = null;
          state.data = payload;
          state.searchFor = null;
        },
        rejected: (state, action) => {
          state.mapping = null;
          state.actionError = readRejection(action, "That didn't save.");
        },
      },
    ),
    searchFoodsAsync: create.asyncThunk(
      async (q: string, { rejectWithValue }) => {
        try {
          return await searchNutritionFoods(q);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.searching = true;
        },
        fulfilled: (state, action) => {
          const payload = nutritionFoodsSerializer(action.payload);
          state.searching = false;
          state.foods = payload;
        },
        rejected: state => {
          state.searching = false;
        },
      },
    ),
  }),
  selectors: {
    selectNutritionVendor: state => state,
  },
});

export const { openFoodSearch, setFoodQuery, loadVendorNutritionAsync, setNutritionHiddenAsync, mapIngredientAsync, searchFoodsAsync } = nutritionVendorSlice.actions;
export const { selectNutritionVendor } = nutritionVendorSlice.selectors;
