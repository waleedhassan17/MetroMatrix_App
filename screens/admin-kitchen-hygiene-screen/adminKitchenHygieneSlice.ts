// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: hygiene checks slice
// ═══════════════════════════════════════════════════════
// The kitchens whose hygiene checklist is complete (self-declared, waiting for
// staff) and the ones verified, and the review: verify after a visit or a
// video call, or take a verification back with a reason. The review screen
// reads this slice.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchHygieneQueue, revokeHygiene, verifyHygiene } from '../../networks/admin/adminKitchen';
import { toRejectedValue } from '../../networks/network/network';
import type { HygieneReview } from '../../models';
import {
  NO_ERROR,
  readRejection,
  type FormStatus,
  type ServerError,
} from '../shared/formStatus';
import { hygieneQueueSerializer } from '../../serializers/kitchen/adminKitchenSerializer';

export type HygieneTab = 'self_declared' | 'verified';

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
  tab: 'self_declared',
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
          return await fetchHygieneQueue(tab);
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
          state.tab = action.meta.arg;
          state.items = hygieneQueueSerializer(action.payload);
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The hygiene checks didn't load.");
        },
      },
    ),

    reviewHygieneAsync: create.asyncThunk(
      async (input: { brandId: string; verify: boolean; method?: 'visit' | 'video_call'; note?: string }, { rejectWithValue }) => {
        try {
          if (input.verify) await verifyHygiene(input.brandId, input.method ?? 'visit', input.note);
          else await revokeHygiene(input.brandId, input.note ?? '');
          return await fetchHygieneQueue(input.verify ? 'verified' : 'self_declared');
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
          const payload = hygieneQueueSerializer(action.payload);
          state.busy = false;
          state.noteOpen = false;
          state.tab = action.meta.arg.verify ? 'verified' : 'self_declared';
          state.items = payload;
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
