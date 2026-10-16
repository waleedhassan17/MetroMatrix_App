// ═══════════════════════════════════════════════════════
// MetroMatrix — Device preferences (persisted)
// ═══════════════════════════════════════════════════════
// Belongs to the device, not the account: survives RESET_ALL_STATE and is the
// only slice redux-persist writes in full (see store.ts).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from './createAppSlice';
import type { ServiceName } from '../theme/services';
import { resetAllState } from './resetAllState';

/** Recent Shopping searches kept on the device. */
export const MAX_RECENT_SEARCHES = 10;

export interface PreferencesSliceState {
  /** The customer's last-used service, so Home reopens where they left it. */
  lastService: Exclude<ServiceName, 'neutral'>;
  /** The notifications pre-prompt has been answered on this device. */
  pushPromptSeen: boolean;
  /** Recent Shopping searches, newest first. Cleared on sign-out (they are the person's). */
  recentSearches: string[];
  /** Recent Health searches ("acne", a doctor's name), newest first. Cleared on sign-out. */
  recentHealthSearches: string[];
}

const initialState: PreferencesSliceState = {
  // Food first: the flagship service, and the first one onboarding shows.
  lastService: 'food',
  pushPromptSeen: false,
  recentSearches: [],
  recentHealthSearches: [],
};

export const preferencesSlice = createAppSlice({
  name: 'preferences',
  initialState,
  reducers: create => ({
    setPushPromptSeen: create.reducer(state => {
      state.pushPromptSeen = true;
    }),
    setLastService: create.reducer(
      (state, action: PayloadAction<PreferencesSliceState['lastService']>) => {
        state.lastService = action.payload;
      },
    ),
    addRecentSearch: create.reducer((state, action: PayloadAction<string>) => {
      const q = action.payload.trim();
      if (!q) return;
      const rest = (state.recentSearches ?? []).filter(x => x.toLowerCase() !== q.toLowerCase());
      state.recentSearches = [q, ...rest].slice(0, MAX_RECENT_SEARCHES);
    }),
    removeRecentSearch: create.reducer((state, action: PayloadAction<string>) => {
      state.recentSearches = (state.recentSearches ?? []).filter(x => x !== action.payload);
    }),
    clearRecentSearches: create.reducer(state => {
      state.recentSearches = [];
    }),
    addRecentHealthSearch: create.reducer((state, action: PayloadAction<string>) => {
      const q = action.payload.trim();
      if (!q) return;
      const rest = (state.recentHealthSearches ?? []).filter(x => x.toLowerCase() !== q.toLowerCase());
      state.recentHealthSearches = [q, ...rest].slice(0, MAX_RECENT_SEARCHES);
    }),
    removeRecentHealthSearch: create.reducer((state, action: PayloadAction<string>) => {
      state.recentHealthSearches = (state.recentHealthSearches ?? []).filter(x => x !== action.payload);
    }),
    clearRecentHealthSearches: create.reducer(state => {
      state.recentHealthSearches = [];
    }),
  }),

  // The device keeps its settings across accounts; a person's searches go with them.
  extraReducers: builder => {
    builder.addCase(resetAllState, state => {
      state.recentSearches = [];
      state.recentHealthSearches = [];
    });
  },

  selectors: {
    selectLastService: state => state.lastService,
    selectPushPromptSeen: state => state.pushPromptSeen,
    selectRecentSearches: state => state.recentSearches ?? [],
    selectRecentHealthSearches: state => state.recentHealthSearches ?? [],
  },
});

export const {
  setLastService,
  setPushPromptSeen,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  addRecentHealthSearch,
  removeRecentHealthSearch,
  clearRecentHealthSearches,
} = preferencesSlice.actions;

export const { selectLastService, selectPushPromptSeen, selectRecentSearches, selectRecentHealthSearches } = preferencesSlice.selectors;
