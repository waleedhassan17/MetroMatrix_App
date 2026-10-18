// MetroMatrix — Admin Food review moderation slice: on pages or hidden, low
// ratings only, one vendor's, and the hide-with-reason sheet.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { setFoodReviewHidden } from '@networks/admin/adminFoodNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { NO_ERROR, readRejection, type ServerError } from '../../../Auth/shared/formStatus';

export interface AdminFoodReviewsSliceState {
  hidden: boolean;
  lowOnly: boolean;
  vendor: { id: string; name: string | null } | null;
  /** Review id the hide sheet is open for. */
  hiding: string | null;
  reason: string;
  reasonTouched: boolean;
  busy: string | null;
  error: ServerError;
}

const initialState: AdminFoodReviewsSliceState = {
  hidden: false,
  lowOnly: false,
  vendor: null,
  hiding: null,
  reason: '',
  reasonTouched: false,
  busy: null,
  error: NO_ERROR,
};

export const adminFoodReviewsSlice = createAppSlice({
  name: 'adminFoodReviews',
  initialState,
  reducers: create => ({
    setFoodReviewsHidden: create.reducer((state, action: PayloadAction<boolean>) => {
      state.hidden = action.payload;
      state.error = NO_ERROR;
    }),
    setFoodReviewsLowOnly: create.reducer((state, action: PayloadAction<boolean>) => {
      state.lowOnly = action.payload;
    }),
    setFoodReviewsVendor: create.reducer(
      (state, action: PayloadAction<{ id: string; name: string | null } | null>) => {
        state.vendor = action.payload;
      },
    ),
    openHideFoodReview: create.reducer((state, action: PayloadAction<string | null>) => {
      state.hiding = action.payload;
      state.reason = '';
      state.reasonTouched = false;
      state.error = NO_ERROR;
    }),
    setFoodHideReason: create.reducer((state, action: PayloadAction<string>) => {
      state.reason = action.payload.slice(0, 300);
    }),
    touchFoodHideReason: create.reducer(state => {
      state.reasonTouched = true;
    }),
    moderateFoodReviewAsync: create.asyncThunk(
      async (
        { id, hide, reason }: { id: string; hide: boolean; reason: string | null },
        { rejectWithValue },
      ) => {
        try {
          return await setFoodReviewHidden(id, hide, hide ? reason : null);
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
    selectAdminFoodReviews: state => state,
  },
});

export const {
  setFoodReviewsHidden,
  setFoodReviewsLowOnly,
  setFoodReviewsVendor,
  openHideFoodReview,
  setFoodHideReason,
  touchFoodHideReason,
  moderateFoodReviewAsync,
} = adminFoodReviewsSlice.actions;
export const { selectAdminFoodReviews } = adminFoodReviewsSlice.selectors;
