// ═══════════════════════════════════════════════════════
// MetroMatrix — Food home slice
// ═══════════════════════════════════════════════════════
// GET /food/home → promotions, cuisines and kitchens for the customer's
// city. Search text and the cuisine chip filter locally (foodModel).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { getFoodHome } from '@networks/food/foodNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { FoodHome } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../Auth/shared/formStatus';

export interface FoodHomeSliceState {
  food: FoodHome | null;
  status: FormStatus;
  /** Pull to refresh, as opposed to the first load. */
  refreshing: boolean;
  error: ServerError;
  query: string;
  cuisine: string | null;
}

const initialState: FoodHomeSliceState = {
  food: null,
  status: 'idle',
  refreshing: false,
  error: NO_ERROR,
  query: '',
  cuisine: null,
};

export const foodHomeSlice = createAppSlice({
  name: 'foodHome',
  initialState,
  reducers: create => ({
    setQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.query = action.payload;
    }),
    /** Tapping the selected cuisine again clears it. */
    toggleCuisine: create.reducer((state, action: PayloadAction<string>) => {
      state.cuisine = state.cuisine === action.payload ? null : action.payload;
    }),
    clearFilters: create.reducer(state => {
      state.query = '';
      state.cuisine = null;
    }),

    loadFoodHomeAsync: create.asyncThunk(
      async ({ city }: { city: string | null; refresh: boolean }, { rejectWithValue }) => {
        try {
          return await getFoodHome(city);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.status = 'loading';
          state.refreshing = action.meta.arg.refresh;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.refreshing = false;
          state.food = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.refreshing = false;
          state.error = readRejection(action, "We couldn't load kitchens near you.");
        },
      },
    ),
  }),
  selectors: {
    selectFoodHome: state => state,
  },
});

export const { setQuery, toggleCuisine, clearFilters, loadFoodHomeAsync } = foodHomeSlice.actions;
export const { selectFoodHome } = foodHomeSlice.selectors;
