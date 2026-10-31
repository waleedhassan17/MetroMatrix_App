// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: hygiene checks slice
// ═══════════════════════════════════════════════════════
// The kitchens that asked staff to verify their hygiene checklist (and the
// ones already verified or sent back), and the review: verify, or say what
// needs fixing. The review screen reads this slice.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { getHygieneQueueAPI, rejectHygieneAPI, verifyHygieneAPI } from '../../networks/admin/adminKitchenNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import type { HygieneReview } from '../../models';
import {
  NO_ERROR,
  readRejection,
  type FormStatus,
  type ServerError,
} from '../shared/formStatus';
import { hygieneQueueSerializer } from '../../serializers/kitchen/reachSerializer';

export type HygieneTab = 'pending' | 'verified' | 'rejected';

export interface AdminKitchenHygieneSliceState {
  tab: HygieneTab;
  items: HygieneReview[];
  status: FormStatus;
  error: ServerError;
  note: string;
  noteOpen: boolean;
  submitted: boolean;
  busy: boolean;
  actionError: ServerError;
}

const initialState: AdminKitchenHygieneSliceState = {
  tab: 'pending',
  items: [],
  status: 'idle',
  error: NO_ERROR,
  note: '',
  noteOpen: false,
  submitted: false,
  busy: false,
  actionError: NO_ERROR,
};

export const adminKitchenHygieneSlice = createAppSlice({
  name: 'adminKitchenHygiene',
  initialState,
  reducers: create => ({
    setHygieneTab: create.reducer((state, action: PayloadAction<HygieneTab>) => {
      state.tab = action.payload;
    }),
    openRejectNote: create.reducer((state, action: PayloadAction<boolean>) => {
      state.noteOpen = action.payload;
      state.note = '';
      state.submitted = false;
      state.actionError = NO_ERROR;
    }),
    setRejectNote: create.reducer((state, action: PayloadAction<string>) => {
      state.note = action.payload.slice(0, 300);
    }),
    markRejectSubmitted: create.reducer(state => {
      state.submitted = true;
    }),

    loadHygieneAsync: create.asyncThunk(
      async (tab: HygieneTab, { rejectWithValue }) => {
        try {
          return { tab, items: required(hygieneQueueSerializer(await getHygieneQueueAPI(tab))) };
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
          state.tab = action.payload.tab;
          state.items = action.payload.items;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The hygiene checks didn't load.");
        },
      },
    ),

    reviewHygieneAsync: create.asyncThunk(
      async (input: { businessId: string; verify: boolean; note?: string }, { rejectWithValue }) => {
        try {
          if (input.verify) await verifyHygieneAPI(input.businessId);
          else await rejectHygieneAPI(input.businessId, input.note ?? '');
          return required(hygieneQueueSerializer(await getHygieneQueueAPI('pending')));
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
          state.noteOpen = false;
          state.tab = 'pending';
          state.items = action.payload;
        },
        rejected: (state, action) => {
          state.busy = false;
          state.actionError = readRejection(action, "That didn't go through.");
        },
      },
    ),
  }),
  selectors: {
    selectAdminKitchenHygiene: state => state,
  },
});

export const {
  setHygieneTab,
  openRejectNote,
  setRejectNote,
  markRejectSubmitted,
  loadHygieneAsync,
  reviewHygieneAsync,
} = adminKitchenHygieneSlice.actions;
export const { selectAdminKitchenHygiene } = adminKitchenHygieneSlice.selectors;
