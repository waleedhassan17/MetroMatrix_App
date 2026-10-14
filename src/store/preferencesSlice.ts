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
  /** The notifications pre-prompt has been answered on this device. */
  pushPromptSeen: boolean;
}

const initialState: PreferencesSliceState = {
  themeMode: 'system',
  lastService: 'shopping',
  pushPromptSeen: false,
};

export const preferencesSlice = createAppSlice({
  name: 'preferences',
  initialState,
  reducers: create => ({
    setThemeMode: create.reducer((state, action: PayloadAction<ThemeMode>) => {
      state.themeMode = action.payload;
    }),
    setPushPromptSeen: create.reducer(state => {
      state.pushPromptSeen = true;
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
    selectPushPromptSeen: state => state.pushPromptSeen,
  },
});

export const { setThemeMode, setLastService, setPushPromptSeen } = preferencesSlice.actions;

export const { selectThemeMode, selectLastService, selectPushPromptSeen } = preferencesSlice.selectors;
