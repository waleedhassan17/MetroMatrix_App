// ═══════════════════════════════════════════════════════
// MetroMatrix — Device preferences (persisted)
// ═══════════════════════════════════════════════════════
// Belongs to the device, not the account: survives RESET_ALL_STATE and is the
// only slice redux-persist writes in full (see store.ts).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from './createAppSlice';
import type { ServiceName } from '../theme/services';
import { resetAllState } from './resetAllState';
import type { FoodPoint } from '../types/food';
import type { VoiceLanguage } from '../types/kitchen';

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
  /** Food Court: where to deliver (a saved address or where the customer is). */
  foodPoint?: FoodPoint | null;
  recentFoodSearches?: string[];
  /** Voice entry: the language last picked on the mic's chip. */
  voiceLanguage?: VoiceLanguage;
  /** The microphone was explained before the first recording on this device. */
  micExplained?: boolean;
  /** The kitchen board speaks new orders (this device's speaker). */
  announce?: AnnounceLanguage;
}

export type AnnounceLanguage = 'off' | 'ur' | 'en';

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
    setFoodPoint: create.reducer((state, action: PayloadAction<FoodPoint | null>) => {
      state.foodPoint = action.payload;
    }),
    addRecentFoodSearch: create.reducer((state, action: PayloadAction<string>) => {
      const q = action.payload.trim();
      if (!q) return;
      const rest = (state.recentFoodSearches ?? []).filter(x => x.toLowerCase() !== q.toLowerCase());
      state.recentFoodSearches = [q, ...rest].slice(0, MAX_RECENT_SEARCHES);
    }),
    clearRecentFoodSearches: create.reducer(state => {
      state.recentFoodSearches = [];
    }),
    setVoiceLanguage: create.reducer((state, action: PayloadAction<VoiceLanguage>) => {
      state.voiceLanguage = action.payload;
    }),
    setMicExplained: create.reducer(state => {
      state.micExplained = true;
    }),
    setAnnounce: create.reducer((state, action: PayloadAction<AnnounceLanguage>) => {
      state.announce = action.payload;
    }),
  }),

  // The device keeps its settings across accounts; a person's searches go with them.
  extraReducers: builder => {
    builder.addCase(resetAllState, state => {
      state.recentSearches = [];
      state.recentHealthSearches = [];
      // A saved address belongs to the account that saved it.
      state.foodPoint = null;
      state.recentFoodSearches = [];
    });
  },

  selectors: {
    selectLastService: state => state.lastService,
    selectPushPromptSeen: state => state.pushPromptSeen,
    selectRecentSearches: state => state.recentSearches ?? [],
    selectRecentHealthSearches: state => state.recentHealthSearches ?? [],
    selectFoodPoint: state => state.foodPoint ?? null,
    selectRecentFoodSearches: state => state.recentFoodSearches ?? [],
    selectVoiceLanguage: state => state.voiceLanguage ?? 'auto',
    selectMicExplained: state => !!state.micExplained,
    selectAnnounce: state => state.announce ?? 'off',
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
  setFoodPoint,
  addRecentFoodSearch,
  clearRecentFoodSearches,
  setVoiceLanguage,
  setMicExplained,
  setAnnounce,
} = preferencesSlice.actions;

export const {
  selectLastService,
  selectPushPromptSeen,
  selectRecentSearches,
  selectRecentHealthSearches,
  selectFoodPoint,
  selectRecentFoodSearches,
  selectVoiceLanguage,
  selectMicExplained,
  selectAnnounce,
} = preferencesSlice.selectors;
