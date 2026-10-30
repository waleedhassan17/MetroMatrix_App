// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: code lookup slice
// ═══════════════════════════════════════════════════════
// A tiffin (TF-) or catering (CT-) code a customer or a kitchen gives
// support, looked up as its kitchen sees it.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { lookupGrowthCodeAPI } from '@networks/admin/adminKitchenNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { GrowthLookup } from '@/types';
import {
  NO_ERROR,
  readRejection,
  type FormStatus,
  type ServerError,
} from '../../../Auth/shared/formStatus';
import { growthLookupSerializer } from '@serializers/kitchen/adminKitchenSerializer';

export interface AdminKitchenLookupSliceState {
  code: string;
  submitted: boolean;
  result: GrowthLookup | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: AdminKitchenLookupSliceState = { code: '', submitted: false, result: null, status: 'idle', error: NO_ERROR };

export const adminKitchenLookupSlice = createAppSlice({
  name: 'adminKitchenLookup',
  initialState,
  reducers: create => ({
    setLookupCode: create.reducer((state, action: PayloadAction<string>) => {
      state.code = action.payload.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 14);
      state.submitted = false;
    }),
    markLookupSubmitted: create.reducer(state => {
      state.submitted = true;
    }),

    lookupCodeAsync: create.asyncThunk(
      async (code: string, { rejectWithValue }) => {
        try {
          return required(growthLookupSerializer(await lookupGrowthCodeAPI(code)));
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
          state.result = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.result = null;
          state.error = readRejection(action, "That code couldn't be looked up.");
        },
      },
    ),
  }),
  selectors: {
    selectAdminKitchenLookup: state => state,
  },
});

export const { setLookupCode, markLookupSubmitted, lookupCodeAsync } = adminKitchenLookupSlice.actions;
export const { selectAdminKitchenLookup } = adminKitchenLookupSlice.selectors;
