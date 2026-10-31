// MetroMatrix — Food vendor reviews slice: waiting for a reply or all, and
// the reply sheet.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../../store/createAppSlice';
import { replyToReviewAPI } from '../../../../networks/food/vendor/reviewsNetwork';
import { toRejectedValue, required } from '../../../../networks/network/apiHelpers';
import { MAX_REPLY } from '../../../../models/food/reviewModel';
import { NO_ERROR, readRejection, type ServerError } from '../../../Auth/shared/formStatus';
import { foodReviewSerializer } from '../../../../serializers/food/reviewSerializer';

export interface VendorReviewsSliceState {
  unreplied: boolean;
  /** Review id the reply sheet is open for. */
  replying: string | null;
  reply: string;
  replyTouched: boolean;
  busy: boolean;
  error: ServerError;
}

const initialState: VendorReviewsSliceState = { unreplied: true, replying: null, reply: '', replyTouched: false, busy: false, error: NO_ERROR };

export const vendorReviewsSlice = createAppSlice({
  name: 'vendorReviews',
  initialState,
  reducers: create => ({
    setUnrepliedOnly: create.reducer((state, action: PayloadAction<boolean>) => {
      state.unreplied = action.payload;
      state.error = NO_ERROR;
    }),
    openReply: create.reducer((state, action: PayloadAction<{ id: string; current: string | null } | null>) => {
      state.replying = action.payload?.id ?? null;
      state.reply = action.payload?.current ?? '';
      state.replyTouched = false;
      state.error = NO_ERROR;
    }),
    setReply: create.reducer((state, action: PayloadAction<string>) => {
      state.reply = action.payload.slice(0, MAX_REPLY);
    }),
    touchReply: create.reducer(state => {
      state.replyTouched = true;
    }),
    sendReplyAsync: create.asyncThunk(
      async ({ id, reply }: { id: string; reply: string }, { rejectWithValue }) => {
        try {
          return required(foodReviewSerializer(await replyToReviewAPI(id, reply)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = true;
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.busy = false;
          state.replying = null;
          state.reply = '';
        },
        rejected: (state, action) => {
          state.busy = false;
          state.error = readRejection(action, "Your reply didn't go through.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorReviews: state => state,
  },
});

export const { setUnrepliedOnly, openReply, setReply, touchReply, sendReplyAsync } = vendorReviewsSlice.actions;
export const { selectVendorReviews } = vendorReviewsSlice.selectors;
