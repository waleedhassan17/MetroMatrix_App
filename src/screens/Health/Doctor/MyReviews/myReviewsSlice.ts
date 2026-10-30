// MetroMatrix — Reviews of you: the summary, the unreplied filter, and the reply composer.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { getOwnReviewSummaryAPI, replyToReviewAPI } from '@networks/health/doctor/doctorReviewsNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { DoctorReview, DoctorReviewSummary } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { reviewSummarySerializer, doctorReviewSerializer } from '@serializers/health/discoverySerializer';

export interface MyReviewsSliceState {
  summary: DoctorReviewSummary | null;
  unreplied: boolean;
  replying: DoctorReview | null;
  text: string;
  status: FormStatus;
  error: ServerError;
}

const initialState: MyReviewsSliceState = { summary: null, unreplied: false, replying: null, text: '', status: 'idle', error: NO_ERROR };

export const myReviewsSlice = createAppSlice({
  name: 'myReviews',
  initialState,
  reducers: create => ({
    setUnreplied: create.reducer((state, action: PayloadAction<boolean>) => {
      state.unreplied = action.payload;
    }),
    openReply: create.reducer((state, action: PayloadAction<DoctorReview | null>) => {
      state.replying = action.payload;
      state.text = action.payload?.reply?.text ?? '';
      state.error = NO_ERROR;
    }),
    setReplyText: create.reducer((state, action: PayloadAction<string>) => {
      state.text = action.payload;
    }),
    loadReviewSummaryAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(reviewSummarySerializer(await getOwnReviewSummaryAPI()));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          state.summary = action.payload;
        },
      },
    ),
    sendReplyAsync: create.asyncThunk(
      async ({ id, text }: { id: string; text: string }, { rejectWithValue }) => {
        try {
          return required(doctorReviewSerializer(await replyToReviewAPI(id, text.trim())));
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
          state.replying = null;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your reply wasn't sent.");
        },
      },
    ),
  }),
  selectors: {
    selectMyReviews: state => state,
  },
});

export const { setUnreplied, openReply, setReplyText, loadReviewSummaryAsync, sendReplyAsync } = myReviewsSlice.actions;
export const { selectMyReviews } = myReviewsSlice.selectors;
