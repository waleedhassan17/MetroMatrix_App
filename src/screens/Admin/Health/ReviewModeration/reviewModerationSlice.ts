// MetroMatrix — Admin review moderation slice: visible or hidden reviews,
// and the hide-with-reason sheet.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { setReviewHiddenAPI } from '@networks/admin/adminHealthNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import { NO_ERROR, readRejection, type ServerError } from '../../../Auth/shared/formStatus';
import { doctorReviewSerializer } from '@serializers/health/discoverySerializer';

export interface ReviewModerationSliceState {
  hidden: boolean;
  /** Review id the hide sheet is open for. */
  hiding: string | null;
  reason: string;
  reasonTouched: boolean;
  busy: string | null;
  error: ServerError;
}

const initialState: ReviewModerationSliceState = { hidden: false, hiding: null, reason: '', reasonTouched: false, busy: null, error: NO_ERROR };

export const reviewModerationSlice = createAppSlice({
  name: 'reviewModeration',
  initialState,
  reducers: create => ({
    setShowHidden: create.reducer((state, action: PayloadAction<boolean>) => {
      state.hidden = action.payload;
      state.error = NO_ERROR;
    }),
    openHide: create.reducer((state, action: PayloadAction<string | null>) => {
      state.hiding = action.payload;
      state.reason = '';
      state.reasonTouched = false;
      state.error = NO_ERROR;
    }),
    setHideReason: create.reducer((state, action: PayloadAction<string>) => {
      state.reason = action.payload.slice(0, 300);
    }),
    touchHideReason: create.reducer(state => {
      state.reasonTouched = true;
    }),
    moderateReviewAsync: create.asyncThunk(
      async ({ id, hide, reason }: { id: string; hide: boolean; reason: string | null }, { rejectWithValue }) => {
        try {
          return required(doctorReviewSerializer(await setReviewHiddenAPI(id, hide, hide ? (reason ?? '').trim() : null)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busy = action.meta.arg.id;
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.busy = null;
          state.hiding = null;
        },
        rejected: (state, action) => {
          state.busy = null;
          state.error = readRejection(action, "That didn't go through.");
        },
      },
    ),
  }),
  selectors: {
    selectReviewModeration: state => state,
  },
});

export const { setShowHidden, openHide, setHideReason, touchHideReason, moderateReviewAsync } = reviewModerationSlice.actions;
export const { selectReviewModeration } = reviewModerationSlice.selectors;
