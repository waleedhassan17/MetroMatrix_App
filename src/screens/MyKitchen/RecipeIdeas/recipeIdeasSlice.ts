// MetroMatrix — My Kitchen: recipe ideas from what's in the pantry (an
// assistant action: 30 a month), in English or Urdu, by time and servings.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { suggestHomeRecipesAPI } from '@networks/myKitchen/recipesNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { RecipeIdea } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../Auth/shared/formStatus';
import { recipeIdeasSerializer } from '@serializers/myKitchen/myKitchenSerializer';

export interface RecipeIdeasSliceState {
  language: 'en' | 'ur';
  maxMinutes: number | null;
  servings: number;
  ideas: RecipeIdea[];
  status: FormStatus;
  error: ServerError;
}

const initialState: RecipeIdeasSliceState = { language: 'en', maxMinutes: null, servings: 4, ideas: [], status: 'idle', error: NO_ERROR };

export const recipeIdeasSlice = createAppSlice({
  name: 'recipeIdeas',
  initialState,
  reducers: create => ({
    setRecipeFilter: create.reducer((state, action: PayloadAction<Partial<Pick<RecipeIdeasSliceState, 'language' | 'maxMinutes' | 'servings'>>>) => {
      Object.assign(state, action.payload);
    }),
    suggestRecipesAsync: create.asyncThunk(
      async (q: { language: 'en' | 'ur'; maxMinutes: number | null; servings: number }, { rejectWithValue }) => {
        try {
          return required(recipeIdeasSerializer(await suggestHomeRecipesAPI(q)));
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
          state.ideas = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The ideas didn't come.");
        },
      },
    ),
  }),
  selectors: {
    selectRecipeIdeas: state => state,
  },
});

export const { setRecipeFilter, suggestRecipesAsync } = recipeIdeasSlice.actions;
export const { selectRecipeIdeas } = recipeIdeasSlice.selectors;
