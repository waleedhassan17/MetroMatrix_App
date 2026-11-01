// MetroMatrix — Kitchen: recipes and costs. Every dish with what it costs to
// make against its price, or "no recipe card"; the target food cost.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchCosting } from '../../networks/kitchen/recipes';
import { fetchMenuCategories, fetchMenuItems } from '../../networks/food/vendor/menu';
import { toRejectedValue } from '../../networks/network/network';
import type { RecipeList } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { recipeListSerializer } from '../../serializers/kitchen/recipeSerializer';

export interface RecipesAndCostsSliceState {
  needsRecipe: boolean;
  list: RecipeList | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: RecipesAndCostsSliceState = { needsRecipe: false, list: null, status: 'idle', error: NO_ERROR };

export const recipesAndCostsSlice = createAppSlice({
  name: 'recipesAndCosts',
  initialState,
  reducers: create => ({
    setNeedsRecipe: create.reducer((state, action: PayloadAction<boolean>) => {
      state.needsRecipe = action.payload;
    }),
    loadRecipesAsync: create.asyncThunk(
      async (_needsRecipe: boolean, { rejectWithValue }) => {
        try {
          // The costing (every dish and size), with the menu's photos and categories.
          const [costing, menu, categories] = await Promise.all([fetchCosting(), fetchMenuItems(), fetchMenuCategories()]);
          return { costing, menu, categories };
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
          const payload = recipeListSerializer(action.payload);
          state.status = 'succeeded';
          // "Needs a recipe": the dishes without one.
          state.list = payload && action.meta.arg ? { ...payload, items: payload.items.filter(i => i.status === 'missing') } : payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your recipes didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectRecipesAndCosts: state => state,
  },
});

export const { setNeedsRecipe, loadRecipesAsync } = recipesAndCostsSlice.actions;
export const { selectRecipesAndCosts } = recipesAndCostsSlice.selectors;
