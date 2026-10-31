// MetroMatrix — Health search slice: the text being typed and its live
// suggestions (doctors, specialties, conditions).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { suggest } from '../../networks/health/discovery';
import { toRejectedValue, required } from '../../networks/network/network';
import type { HealthSuggestions } from '../../models';
import type { FormStatus } from '../shared/formStatus';
import { suggestionsSerializer } from '../../serializers/health/discoverySerializer';

const NONE: HealthSuggestions = { doctors: [], specialties: [], conditions: [] };

export interface HealthSearchSliceState {
  query: string;
  suggestions: HealthSuggestions;
  /** The text the suggestions are for (an older answer is dropped). */
  suggestedFor: string;
  status: FormStatus;
}

const initialState: HealthSearchSliceState = { query: '', suggestions: NONE, suggestedFor: '', status: 'idle' };

export const healthSearchSlice = createAppSlice({
  name: 'healthSearch',
  initialState,
  reducers: create => ({
    setHealthQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.query = action.payload;
      if (!action.payload.trim()) {
        state.suggestions = NONE;
        state.suggestedFor = '';
      }
    }),
    healthSuggestAsync: create.asyncThunk(
      async (q: string, { rejectWithValue }) => {
        try {
          return required(suggestionsSerializer(await suggest(q)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
        },
        fulfilled: (state, action) => {
          // Only the answer for what is in the box now.
          if (action.meta.arg !== state.query.trim()) return;
          state.status = 'succeeded';
          state.suggestions = action.payload;
          state.suggestedFor = action.meta.arg;
        },
        rejected: state => {
          state.status = 'failed';
        },
      },
    ),
  }),
  selectors: {
    selectHealthSearch: state => state,
  },
});

export const { setHealthQuery, healthSuggestAsync } = healthSearchSlice.actions;
export const { selectHealthSearch } = healthSearchSlice.selectors;
