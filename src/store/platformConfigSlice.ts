// ═══════════════════════════════════════════════════════
// MetroMatrix — platform config (GET /config) and the server's notices
// ═══════════════════════════════════════════════════════
// Loaded at boot by AppContainer, refreshed on Retry. The API client also
// reports what the server refuses mid-session (503 MAINTENANCE, 503
// SERVICE_PAUSED, 403 SIGNUPS_PAUSED) through utils/authEvents, so a switch
// flipped after boot shows its screen at once. A shell slice: it describes
// the platform, not the account, and survives RESET_ALL_STATE.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from './createAppSlice';
import { fetchPlatformConfig } from '../networks/config/configNetwork';
import { OPEN_PLATFORM, type PlatformConfig, type PlatformService } from '../types/platformConfig';

export interface PlatformConfigSliceState {
  config: PlatformConfig;
  status: 'idle' | 'loading' | 'loaded' | 'failed';
}

const initialState: PlatformConfigSliceState = { config: OPEN_PLATFORM, status: 'idle' };

export const platformConfigSlice = createAppSlice({
  name: 'platformConfig',
  initialState,
  reducers: create => ({
    /**
     * Best effort: if /config can't be read the app stays open — the server
     * still refuses whatever is switched off, and those refusals land here.
     */
    loadPlatformConfig: create.asyncThunk(async () => fetchPlatformConfig(), {
      pending: state => {
        state.status = 'loading';
      },
      fulfilled: (state, action) => {
        state.config = action.payload;
        state.status = 'loaded';
      },
      rejected: state => {
        state.status = 'failed';
      },
    }),
    maintenanceReported: create.reducer((state, action: PayloadAction<{ message: string }>) => {
      state.config.maintenance = { enabled: true, message: action.payload.message };
    }),
    servicePausedReported: create.reducer((state, action: PayloadAction<{ service: PlatformService }>) => {
      state.config.services[action.payload.service] = false;
    }),
    signupsPausedReported: create.reducer((state, action: PayloadAction<{ role: 'customer' | 'partner' }>) => {
      state.config.signupsEnabled[action.payload.role] = false;
    }),
  }),
  selectors: {
    selectPlatformConfig: state => state.config,
    selectPlatformStatus: state => state.status,
    selectMaintenance: state => state.config.maintenance,
    /** Kitchen lives inside Food: Food off pauses it too. */
    selectServicePaused: (state, service: PlatformService) =>
      !state.config.services[service] || (service === 'kitchen' && !state.config.services.food),
    selectSignupsOpen: (state, role: 'customer' | 'partner') => state.config.signupsEnabled[role],
  },
});

export const { loadPlatformConfig, maintenanceReported, servicePausedReported, signupsPausedReported } =
  platformConfigSlice.actions;
export const {
  selectPlatformConfig,
  selectPlatformStatus,
  selectMaintenance,
  selectServicePaused,
  selectSignupsOpen,
} = platformConfigSlice.selectors;
