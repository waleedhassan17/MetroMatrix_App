// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court search
// ═══════════════════════════════════════════════════════
// Restaurants and dishes for what the customer typed, near their point.
// Recent searches are a device preference (preferences.recentFoodSearches).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { searchFood } from '@networks/food/discoveryNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { addRecentFoodSearch } from '@store/preferencesSlice';
import type { FoodSearchResult } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export type FoodSearchTab = 'restaurants' | 'dishes';

export interface FoodSearchSliceState {
  text: string;
  tab: FoodSearchTab;
  /** What the shown results are for. */
  query: string;
  result: FoodSearchResult | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: FoodSearchSliceState = { text: '', tab: 'restaurants', query: '', result: null, status: 'idle', error: NO_ERROR };

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
    searchFoodAsync: create.asyncThunk(
      async ({ q, lat, lng, remember }: { q: string; lat: number; lng: number; remember?: boolean }, { dispatch, rejectWithValue }) => {
        try {
          const result = await searchFood(q, lat, lng);
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

export const { setSearchText, setSearchTab, searchFoodAsync } = foodSearchSlice.actions;
export const { selectFoodSearch } = foodSearchSlice.selectors;
