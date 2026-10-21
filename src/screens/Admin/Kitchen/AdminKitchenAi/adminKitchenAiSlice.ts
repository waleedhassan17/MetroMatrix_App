// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: the assistant slice
// ═══════════════════════════════════════════════════════
// The last 30 days of the assistant's use, the switch for everyone, and a
// kitchen's or customer's own monthly limit (empty puts back the plan's).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { getAiUsageReport, setAiEnabled, setAiQuota } from '@networks/admin/adminKitchenNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { AiOwnerUse, AiUsageReport } from '@/types';
import {
  NO_ERROR,
  readRejection,
  type FormStatus,
  type ServerError,
} from '../../../Auth/shared/formStatus';

export interface QuotaSheet {
  ownerId: string;
  name: string;
  kind: AiOwnerUse['kind'];
  limit: string;
}

export interface AdminKitchenAiSliceState {
  report: AiUsageReport | null;
  status: FormStatus;
  error: ServerError;
  sheet: QuotaSheet | null;
  submitted: boolean;
  busy: boolean;
  actionError: ServerError;
}

const initialState: AdminKitchenAiSliceState = {
  report: null,
  status: 'idle',
  error: NO_ERROR,
  sheet: null,
  submitted: false,
  busy: false,
  actionError: NO_ERROR,
};

type Change = { kind: 'enabled'; enabled: boolean } | { kind: 'quota'; ownerId: string; limit: number | null };

export const adminKitchenAiSlice = createAppSlice({
  name: 'adminKitchenAi',
  initialState,
  reducers: create => ({
    openQuotaSheet: create.reducer((state, action: PayloadAction<AiOwnerUse | null>) => {
      const o = action.payload;
      state.sheet = o
        ? { ownerId: o.ownerId, name: o.name, kind: o.kind, limit: o.override === null ? '' : String(o.override) }
        : null;
      state.submitted = false;
      state.actionError = NO_ERROR;
    }),
    setQuotaLimit: create.reducer((state, action: PayloadAction<string>) => {
      if (state.sheet) state.sheet.limit = action.payload.replace(/[^0-9]/g, '').slice(0, 6);
    }),
    markQuotaSubmitted: create.reducer(state => {
      state.submitted = true;
    }),

    loadAiUsageAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await getAiUsageReport();
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
          state.report = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The assistant's use didn't load.");
        },
      },
    ),

    changeAiAsync: create.asyncThunk(
      async (change: Change, { rejectWithValue }) => {
        try {
          if (change.kind === 'enabled') await setAiEnabled(change.enabled);
          else await setAiQuota(change.ownerId, change.limit);
          return await getAiUsageReport();
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
          state.report = action.payload;
        },
        rejected: (state, action) => {
          state.busy = false;
          state.actionError = readRejection(action, "That didn't go through.");
        },
      },
    ),
  }),
  selectors: {
    selectAdminKitchenAi: state => state,
  },
});

export const { openQuotaSheet, setQuotaLimit, markQuotaSubmitted, loadAiUsageAsync, changeAiAsync } =
  adminKitchenAiSlice.actions;
export const { selectAdminKitchenAi } = adminKitchenAiSlice.selectors;
