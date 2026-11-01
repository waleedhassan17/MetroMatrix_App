// MetroMatrix — My Kitchen: one suggested recipe (its pantry items, what's
// missing, the steps), read from the suggestions (cached on the server).

import { createAppSlice } from '../../store/createAppSlice';
import { suggestHomeRecipes } from '../../networks/myKitchen/recipes';
import { toRejectedValue } from '../../networks/network/network';
import type { HomeRecipe } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { homeRecipeSerializer } from '../../serializers/myKitchen/myKitchenSerializer';

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
      async (_: { id: string; language: 'en' | 'ur'; servings: number | null }, { rejectWithValue }) => {
        try {
          return await suggestHomeRecipes();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.status = 'loading';
          state.error = NO_ERROR;
          if (state.recipe?.id !== action.meta.arg.id) state.recipe = null;
        },
        fulfilled: (state, action) => {
          const payload = homeRecipeSerializer(action.payload, action.meta.arg.id);
          state.status = payload ? 'succeeded' : 'failed';
          state.recipe = payload;
          if (!payload) state.error = { ...NO_ERROR, code: 'NOT_FOUND', message: 'That recipe isn’t suggested any more. Your pantry has changed.' };
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
