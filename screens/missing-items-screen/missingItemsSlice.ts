// MetroMatrix — My Kitchen: a recipe's missing items, priced from Shopping's
// grocers per kilo, litre or piece (adding goes through Shopping's own bag).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchMissingItems, suggestHomeRecipes } from '../../networks/myKitchen/recipes';
import { required, toRejectedValue } from '../../networks/network/network';
import type { MissingItem } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { homeRecipeSerializer, missingItemsSerializer } from '../../serializers/myKitchen/myKitchenSerializer';
import type { HomeRecipeSliceState } from '../home-recipe-screen/homeRecipeSlice';
import type { RecipeIdeasSliceState } from '../recipe-ideas-screen/recipeIdeasSlice';

export interface MissingItemsSliceState {
  recipeId: string | null;
  items: MissingItem[];
  status: FormStatus;
  error: ServerError;
  /** Variants already put in the bag from here. */
  added: string[];
}

const initialState: MissingItemsSliceState = { recipeId: null, items: [], status: 'idle', error: NO_ERROR, added: [] };

export const missingItemsSlice = createAppSlice({
  name: 'missingItems',
  initialState,
  reducers: create => ({
    markAddedToBag: create.reducer((state, action: PayloadAction<string>) => {
      if (!state.added.includes(action.payload)) state.added.push(action.payload);
    }),
    loadMissingItemsAsync: create.asyncThunk(
      async ({ id }: { id: string; servings: number | null }, { getState, rejectWithValue }) => {
        // The recipe's missing names: from the recipe or ideas already read, else the suggestions again.
        const st = getState() as { homeRecipe: HomeRecipeSliceState; recipeIdeas: RecipeIdeasSliceState };
        const known = st.homeRecipe.recipe?.id === id ? st.homeRecipe.recipe.ingredients.filter(i => !i.have).map(i => i.name) : st.recipeIdeas.ideas.find(r => r.id === id)?.missing;
        try {
          const names = known ?? required(homeRecipeSerializer(await suggestHomeRecipes(), id)).ingredients.filter(i => !i.have).map(i => i.name);
          return await fetchMissingItems(names);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.status = 'loading';
          state.error = NO_ERROR;
          if (state.recipeId !== action.meta.arg.id) {
            state.items = [];
            state.added = [];
          }
          state.recipeId = action.meta.arg.id;
        },
        fulfilled: (state, action) => {
          const payload = missingItemsSerializer(action.payload);
          state.status = 'succeeded';
          state.items = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The missing items didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectMissingItems: state => state,
  },
});

export const { markAddedToBag, loadMissingItemsAsync } = missingItemsSlice.actions;
export const { selectMissingItems } = missingItemsSlice.selectors;
