// MetroMatrix — Kitchen: recipes and costs. Every dish with what it costs to
// make against its price, or "no recipe card"; the target food cost.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { listRecipes } from '@networks/kitchen/recipesNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { RecipeList } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

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
      async (needsRecipe: boolean, { rejectWithValue }) => {
        try {
          return await listRecipes(needsRecipe);
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
          state.list = action.payload;
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
