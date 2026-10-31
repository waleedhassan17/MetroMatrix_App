// MetroMatrix — Shopping search slice: the text being typed and its live suggestions.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { suggestProducts } from '../../networks/shopping/catalog';
import { toRejectedValue } from '../../networks/network/network';
import type { SearchSuggestion } from '../../models';
import type { FormStatus } from '../shared/formStatus';
import { suggestionListSerializer } from '../../serializers/shopping/catalogSerializer';

/** Suggestions start at this many characters (the API's own minimum). */
export const SUGGEST_MIN = 2;

export interface ShopSearchSliceState {
  query: string;
  suggestions: SearchSuggestion[];
  /** The text the suggestions are for (an older answer is dropped). */
  suggestedFor: string;
  status: FormStatus;
}

const initialState: ShopSearchSliceState = { query: '', suggestions: [], suggestedFor: '', status: 'idle' };

export const shopSearchSlice = createAppSlice({
  name: 'shopSearch',
  initialState,
  reducers: create => ({
    setSearchQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.query = action.payload;
      if (action.payload.trim().length < SUGGEST_MIN) {
        state.suggestions = [];
        state.suggestedFor = '';
      }
    }),
    suggestAsync: create.asyncThunk(
      async (q: string, { rejectWithValue }) => {
        try {
          return await suggestProducts(q);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
        },
        fulfilled: (state, action) => {
          const payload = suggestionListSerializer(action.payload);
          // Only the answer for what is in the box now.
          if (action.meta.arg !== state.query.trim()) return;
          state.status = 'succeeded';
          state.suggestions = payload;
          state.suggestedFor = action.meta.arg;
        },
        rejected: state => {
          state.status = 'failed';
        },
      },
    ),
  }),
  selectors: {
    selectShopSearch: state => state,
  },
});

export const { setSearchQuery, suggestAsync } = shopSearchSlice.actions;
export const { selectShopSearch } = shopSearchSlice.selectors;
