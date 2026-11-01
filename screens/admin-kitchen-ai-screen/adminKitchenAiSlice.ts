// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: the assistant slice
// ═══════════════════════════════════════════════════════
// The last 30 days of use (with the switches as running), and the platform
// switch, a settings change confirmed with the admin's authenticator code.
// A kitchen's monthly allowance is its plan's (Food → Vendors).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchAiSettings, fetchAiUsageReport, setAiEnabled } from '../../networks/admin/adminKitchen';
import { toRejectedValue } from '../../networks/network/network';
import type { AiUsageReport } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { aiUsageReportSerializer } from '../../serializers/kitchen/adminKitchenSerializer';

/** The switch's confirmation: which way, and the code typed so far. */
export interface SwitchSheet {
  enabled: boolean;
  code: string;
}

export interface AdminKitchenAiSliceState {
  report: AiUsageReport | null;
  status: FormStatus;
  error: ServerError;
  sheet: SwitchSheet | null;
  busy: boolean;
  actionError: ServerError;
}

const initialState: AdminKitchenAiSliceState = { report: null, status: 'idle', error: NO_ERROR, sheet: null, busy: false, actionError: NO_ERROR };

export const adminKitchenAiSlice = createAppSlice({
  name: 'adminKitchenAi',
  initialState,
  reducers: create => ({
    openSwitchSheet: create.reducer((state, action: PayloadAction<boolean | null>) => {
      state.sheet = action.payload === null ? null : { enabled: action.payload, code: '' };
      state.actionError = NO_ERROR;
    }),
    setSwitchCode: create.reducer((state, action: PayloadAction<string>) => {
      if (state.sheet) state.sheet.code = action.payload.replace(/\D/g, '').slice(0, 6);
    }),
    loadAiUsageAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          const [usage, settings] = await Promise.all([fetchAiUsageReport(), fetchAiSettings()]);
          return { usage, settings };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.report = aiUsageReportSerializer(action.payload);
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The assistant's numbers didn't load.");
        },
      },
    ),
    /** The switch, then the numbers and switches read again. */
    switchAiAsync: create.asyncThunk(
      async ({ enabled, code }: SwitchSheet, { rejectWithValue }) => {
        try {
          await setAiEnabled(enabled, code);
          const [usage, settings] = await Promise.all([fetchAiUsageReport(), fetchAiSettings()]);
          return { usage, settings };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = true;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = false;
          state.sheet = null;
          state.report = aiUsageReportSerializer(action.payload);
        },
        rejected: (state, action) => {
          state.busy = false;
          state.actionError = readRejection(action, "The switch didn't change.");
        },
      },
    ),
  }),
  selectors: {
    selectAdminKitchenAi: state => state,
  },
});

export const { openSwitchSheet, setSwitchCode, loadAiUsageAsync, switchAiAsync } = adminKitchenAiSlice.actions;
export const { selectAdminKitchenAi } = adminKitchenAiSlice.selectors;
