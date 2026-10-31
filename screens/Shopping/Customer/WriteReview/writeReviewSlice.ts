// ═══════════════════════════════════════════════════════
// MetroMatrix — Write a review (one per delivered item)
// ═══════════════════════════════════════════════════════

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../../store/createAppSlice';
import { writeReviewAPI } from '../../../../networks/shopping/reviewsNetwork';
import { toRejectedValue, required } from '../../../../networks/network/apiHelpers';
import type { LocalFile, ReviewInput } from '../../../../types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { pendingPhoto, photoFailed, photoProgress, photoUploaded, upload, type FormPhoto } from '../shared/photoUploads';
import { reviewSerializer } from '../../../../serializers/shopping/catalogSerializer';

export interface WriteReviewSliceState {
  itemId: string | null;
  rating: number;
  title: string;
  body: string;
  photos: FormPhoto[];
  submitted: boolean;
  status: FormStatus;
  error: ServerError;
}

const initialState: WriteReviewSliceState = {
  itemId: null,
  rating: 0,
  title: '',
  body: '',
  photos: [],
  submitted: false,
  status: 'idle',
  error: NO_ERROR,
};

export const writeReviewSlice = createAppSlice({
  name: 'writeReview',
  initialState,
  reducers: create => ({
    startReview: create.reducer((_state, action: PayloadAction<string>) => ({ ...initialState, itemId: action.payload })),
    setRating: create.reducer((state, action: PayloadAction<number>) => {
      state.rating = action.payload;
    }),
    setReviewTitle: create.reducer((state, action: PayloadAction<string>) => {
      state.title = action.payload.slice(0, 80);
    }),
    setReviewBody: create.reducer((state, action: PayloadAction<string>) => {
      state.body = action.payload;
    }),
    removeReviewPhoto: create.reducer((state, action: PayloadAction<string>) => {
      state.photos = state.photos.filter(p => p.key !== action.payload);
    }),
    reviewPhotoProgress: create.reducer((state, action: PayloadAction<{ key: string; progress: number }>) => {
      photoProgress(state.photos, action.payload.key, action.payload.progress);
    }),
    markReviewSubmitted: create.reducer(state => {
      state.submitted = true;
    }),

    addReviewPhotoAsync: create.asyncThunk(
      async ({ key, file }: { key: string; file: LocalFile }, { dispatch, rejectWithValue }) => {
        try {
          return await upload(file, 'review_photo', progress => dispatch(writeReviewSlice.actions.reviewPhotoProgress({ key, progress })));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.photos.push(pendingPhoto(action.meta.arg.key, action.meta.arg.file));
        },
        fulfilled: (state, action) => {
          photoUploaded(state.photos, action.meta.arg.key, action.payload.url);
        },
        rejected: (state, action) => {
          state.photos = photoFailed(state.photos, action.meta.arg.key);
          state.error = readRejection(action, "A photo didn't upload. Try again.");
        },
      },
    ),

    submitReviewAsync: create.asyncThunk(
      async ({ orderId, itemId, input }: { orderId: string; itemId: string; input: ReviewInput }, { rejectWithValue }) => {
        try {
          return required(reviewSerializer(await writeReviewAPI(orderId, itemId, input)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.submitted = true;
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.status = 'succeeded';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't post your review.");
        },
      },
    ),
  }),
  selectors: {
    selectWriteReview: state => state,
  },
});

export const {
  startReview,
  setRating,
  setReviewTitle,
  setReviewBody,
  removeReviewPhoto,
  markReviewSubmitted,
  addReviewPhotoAsync,
  submitReviewAsync,
} = writeReviewSlice.actions;
export const { selectWriteReview } = writeReviewSlice.selectors;
