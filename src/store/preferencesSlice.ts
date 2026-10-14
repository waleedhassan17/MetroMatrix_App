// ═══════════════════════════════════════════════════════
// MetroMatrix — Device preferences (persisted)
// ═══════════════════════════════════════════════════════
// Belongs to the device, not the account: survives RESET_ALL_STATE and is the
// only slice redux-persist writes in full (see store.ts).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from './createAppSlice';
import type { ServiceName } from '../theme/services';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface PreferencesSliceState {
  themeMode: ThemeMode;
  /** The customer's last-used service, so Home reopens where they left it. */
  lastService: Exclude<ServiceName, 'neutral'>;
}

const initialState: PreferencesSliceState = {
  themeMode: 'system',
  lastService: 'shopping',
};

export const preferencesSlice = createAppSlice({
  name: 'preferences',
  initialState,
  reducers: create => ({
    setThemeMode: create.reducer((state, action: PayloadAction<ThemeMode>) => {
      state.themeMode = action.payload;
    }),
    setLastService: create.reducer(
      (state, action: PayloadAction<PreferencesSliceState['lastService']>) => {
        state.lastService = action.payload;
      },
    ),
  }),

  selectors: {
    selectThemeMode: state => state.themeMode,
    selectLastService: state => state.lastService,
  },
});

export const { setThemeMode, setLastService } = preferencesSlice.actions;

export const { selectThemeMode, selectLastService } = preferencesSlice.selectors;
