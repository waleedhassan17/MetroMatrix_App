// MetroMatrix — Reviews of you: the summary, the unreplied filter, and the reply composer.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchOwnReviewSummary, replyToReview } from '../../networks/health/doctor/doctorReviews';
import { toRejectedValue } from '../../networks/network/network';
import type { DoctorReview, DoctorReviewSummary } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { reviewSummarySerializer, doctorReviewSerializer } from '../../serializers/health/discoverySerializer';

export interface MyReviewsSliceState {
  summary: DoctorReviewSummary | null;
  unreplied: boolean;
  replying: DoctorReview | null;
  text: string;
  status: FormStatus;
  error: ServerError;
  /** The review just replied to, as the server has it now. */
  replied: ReturnType<typeof doctorReviewSerializer>;
}

const initialState: MyReviewsSliceState = { summary: null, unreplied: false, replying: null, text: '', status: 'idle', error: NO_ERROR ,
  replied: null,
};

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
          return await fetchOwnReviewSummary();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          const payload = reviewSummarySerializer(action.payload);
          state.summary = payload;
        },
      },
    ),
    sendReplyAsync: create.asyncThunk(
      async ({ id, text }: { id: string; text: string }, { rejectWithValue }) => {
        try {
          return await replyToReview(id, text.trim());
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
          const payload = doctorReviewSerializer(action.payload);
          state.status = 'succeeded';
          state.replying = null;
          state.replied = payload;
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
