// ═══════════════════════════════════════════════════════
// MetroMatrix — Device preferences (persisted)
// ═══════════════════════════════════════════════════════
// Belongs to the device, not the account: survives RESET_ALL_STATE and is the
// only slice redux-persist writes in full (see store.ts).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from './createAppSlice';
import type { ServiceName } from '../theme/services';

export interface PreferencesSliceState {
  /** The customer's last-used service, so Home reopens where they left it. */
  lastService: Exclude<ServiceName, 'neutral'>;
  /** The notifications pre-prompt has been answered on this device. */
  pushPromptSeen: boolean;
}

const initialState: PreferencesSliceState = {
  lastService: 'shopping',
  pushPromptSeen: false,
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
  }),

  selectors: {
    selectLastService: state => state.lastService,
    selectPushPromptSeen: state => state.pushPromptSeen,
  },
});

export const { setLastService, setPushPromptSeen } = preferencesSlice.actions;

export const { selectLastService, selectPushPromptSeen } = preferencesSlice.selectors;
