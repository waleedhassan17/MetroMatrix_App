// MetroMatrix — Rate a visit: stars, would you recommend, the parts of the visit, tags, words.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../../store/createAppSlice';

import { toRejectedValue } from '../../../../networks/network/apiHelpers';
import { emptyDoctorReview } from '../../../../models/health/reviewFormModel';
import type { DoctorReviewInput, ReviewDimension } from '../../../../types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { reviewAppointment } from '../shared/healthReads';

export interface PostConsultReviewSliceState {
  code: string | null;
  form: DoctorReviewInput;
  touched: boolean;
  status: FormStatus;
  error: ServerError;
}

const initialState: PostConsultReviewSliceState = { code: null, form: emptyDoctorReview(), touched: false, status: 'idle', error: NO_ERROR };

export const postConsultReviewSlice = createAppSlice({
  name: 'postConsultReview',
  initialState,
  reducers: create => ({
    startVisitReview: create.reducer((state, action: PayloadAction<string>) =>
      state.code === action.payload && state.status !== 'succeeded' ? state : { ...initialState, code: action.payload },
    ),
    setVisitRating: create.reducer((state, action: PayloadAction<number>) => {
      state.form.rating = action.payload;
    }),
    setRecommend: create.reducer((state, action: PayloadAction<boolean>) => {
      state.form.recommend = action.payload;
    }),
    setDimension: create.reducer((state, action: PayloadAction<{ key: ReviewDimension; value: number }>) => {
      state.form.dimensions[action.payload.key] = action.payload.value;
    }),
    toggleReviewTag: create.reducer((state, action: PayloadAction<string>) => {
      const t = action.payload;
      state.form.tags = state.form.tags.includes(t) ? state.form.tags.filter(x => x !== t) : [...state.form.tags, t];
    }),
    setReviewText: create.reducer((state, action: PayloadAction<string>) => {
      state.form.text = action.payload || null;
    }),
    setAnonymous: create.reducer((state, action: PayloadAction<boolean>) => {
      state.form.anonymous = action.payload;
    }),
    touchVisitReview: create.reducer(state => {
      state.touched = true;
    }),
    submitVisitReviewAsync: create.asyncThunk(
      async ({ code, form }: { code: string; form: DoctorReviewInput }, { rejectWithValue }) => {
        try {
          return await reviewAppointment(code, { ...form, text: form.text?.trim() || null });
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.touched = true;
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.status = 'succeeded';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your review wasn't sent. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectVisitReview: state => state,
  },
});

export const {
  startVisitReview,
  setVisitRating,
  setRecommend,
  setDimension,
  toggleReviewTag,
  setReviewText,
  setAnonymous,
  touchVisitReview,
  submitVisitReviewAsync,
} = postConsultReviewSlice.actions;
export const { selectVisitReview } = postConsultReviewSlice.selectors;
