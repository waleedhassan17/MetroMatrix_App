// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court search
// ═══════════════════════════════════════════════════════
// Restaurants and dishes for what the customer typed, near their point.
// Recent searches are a device preference (preferences.recentFoodSearches).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { searchFood } from '../../networks/food/discovery';
import { toRejectedValue, required } from '../../networks/network/network';
import { addRecentFoodSearch } from '../../store/preferencesSlice';
import type { FoodSearchResult } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { foodSearchSerializer } from '../../serializers/food/discoverySerializer';

export type FoodSearchTab = 'restaurants' | 'dishes';

export interface FoodSearchSliceState {
  text: string;
  tab: FoodSearchTab;
  /** What the shown results are for. */
  query: string;
  result: FoodSearchResult | null;
  status: FormStatus;
  error: ServerError;
  /** Healthy filter (for people who turned calories on). */
  nutrition: 'under_600' | 'high_protein' | null;
}

const initialState: FoodSearchSliceState = { text: '', tab: 'restaurants', query: '', result: null, status: 'idle', error: NO_ERROR, nutrition: null };

export const MIN_QUERY = 2;

export const foodSearchSlice = createAppSlice({
  name: 'foodSearch',
  initialState,
  reducers: create => ({
    setSearchText: create.reducer((state, action: PayloadAction<string>) => {
      state.text = action.payload;
      if (action.payload.trim().length < MIN_QUERY) {
        state.result = null;
        state.query = '';
        state.status = 'idle';
      }
    }),
    setSearchTab: create.reducer((state, action: PayloadAction<FoodSearchTab>) => {
      state.tab = action.payload;
    }),
    setSearchNutrition: create.reducer((state, action: PayloadAction<FoodSearchSliceState['nutrition']>) => {
      state.nutrition = action.payload;
    }),
    searchFoodAsync: create.asyncThunk(
      async ({ q, lat, lng, remember, nutrition }: { q: string; lat: number; lng: number; remember?: boolean; nutrition?: FoodSearchSliceState['nutrition'] }, { dispatch, rejectWithValue }) => {
        try {
          const result = required(foodSearchSerializer(await searchFood(q, lat, lng, nutrition)));
          if (remember) dispatch(addRecentFoodSearch(q));
          return result;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.status = 'loading';
          state.error = NO_ERROR;
          state.query = action.meta.arg.q;
        },
        fulfilled: (state, action) => {
          // An answer for words no longer in the box is dropped.
          if (action.meta.arg.q !== state.query) return;
          state.status = 'succeeded';
          state.result = action.payload;
          // Open on the tab that has something.
          if (!action.payload.vendors.length && action.payload.dishes.length) state.tab = 'dishes';
          if (action.payload.vendors.length && !action.payload.dishes.length) state.tab = 'restaurants';
        },
        rejected: (state, action) => {
          if (action.meta.arg.q !== state.query) return;
          state.status = 'failed';
          state.error = readRejection(action, "Search didn't work. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectFoodSearch: state => state,
  },
});

export const { setSearchText, setSearchTab, searchFoodAsync, setSearchNutrition } = foodSearchSlice.actions;
export const { selectFoodSearch } = foodSearchSlice.selectors;
