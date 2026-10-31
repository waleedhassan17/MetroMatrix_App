// MetroMatrix — My Kitchen: a recipe's missing items, priced from Shopping's
// grocers per kilo, litre or piece (adding goes through Shopping's own bag).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchMissingItems } from '../../networks/myKitchen/recipes';
import { toRejectedValue, required } from '../../networks/network/network';
import type { MissingItem } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { missingItemsSerializer } from '../../serializers/myKitchen/myKitchenSerializer';

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
      async ({ id, servings }: { id: string; servings: number | null }, { rejectWithValue }) => {
        try {
          return required(missingItemsSerializer(await fetchMissingItems(id, servings)));
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
          state.status = 'succeeded';
          state.items = action.payload;
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
