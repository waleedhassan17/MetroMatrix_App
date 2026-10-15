// MetroMatrix — Store reviews slice: the filter, and the reply being written.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { replyToReview } from '@networks/shopping/partner/partnerReviewsNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export interface StoreReviewsSliceState {
  rating: number | null;
  unrepliedOnly: boolean;
  replyFor: string | null;
  reply: string;
  status: FormStatus;
  error: ServerError;
}

const initialState: StoreReviewsSliceState = { rating: null, unrepliedOnly: false, replyFor: null, reply: '', status: 'idle', error: NO_ERROR };

export const storeReviewsSlice = createAppSlice({
  name: 'storeReviews',
  initialState,
  reducers: create => ({
    setReviewsRating: create.reducer((state, action: PayloadAction<number | null>) => {
      state.rating = action.payload;
    }),
    setUnrepliedOnly: create.reducer((state, action: PayloadAction<boolean>) => {
      state.unrepliedOnly = action.payload;
    }),
    openReply: create.reducer((state, action: PayloadAction<{ id: string; body: string } | null>) => {
      state.replyFor = action.payload?.id ?? null;
      state.reply = action.payload?.body ?? '';
      state.error = NO_ERROR;
    }),
    setReply: create.reducer((state, action: PayloadAction<string>) => {
      state.reply = action.payload.slice(0, 600);
    }),
    postReplyAsync: create.asyncThunk(
      async ({ id, body }: { id: string; body: string }, { rejectWithValue }) => {
        try {
          return await replyToReview(id, body.trim());
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.status = 'succeeded';
          state.replyFor = null;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't post your reply.");
        },
      },
    ),
  }),
  selectors: {
    selectStoreReviews: state => state,
  },
});

export const { setReviewsRating, setUnrepliedOnly, openReply, setReply, postReplyAsync } = storeReviewsSlice.actions;
export const { selectStoreReviews } = storeReviewsSlice.selectors;
