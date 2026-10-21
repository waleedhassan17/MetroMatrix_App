// MetroMatrix — My Kitchen: one recipe, in English or Urdu, scaled to how
// many it's for, with what the kitchen has marked.

import { createAppSlice } from '@store/createAppSlice';
import { getHomeRecipe } from '@networks/myKitchen/recipesNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { HomeRecipe } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../Auth/shared/formStatus';

export interface HomeRecipeSliceState {
  recipe: HomeRecipe | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: HomeRecipeSliceState = { recipe: null, status: 'idle', error: NO_ERROR };

export const homeRecipeSlice = createAppSlice({
  name: 'homeRecipe',
  initialState,
  reducers: create => ({
    loadHomeRecipeAsync: create.asyncThunk(
      async ({ id, language, servings }: { id: string; language: 'en' | 'ur'; servings: number | null }, { rejectWithValue }) => {
        try {
          return await getHomeRecipe(id, language, servings);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.status = 'loading';
          state.error = NO_ERROR;
          if (state.recipe?.id !== action.meta.arg.id || state.recipe?.language !== action.meta.arg.language) state.recipe = null;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.recipe = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The recipe didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectHomeRecipe: state => state,
  },
});

export const { loadHomeRecipeAsync } = homeRecipeSlice.actions;
export const { selectHomeRecipe } = homeRecipeSlice.selectors;
