// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: rate an order (once it arrived)
// ═══════════════════════════════════════════════════════

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { reviewFoodOrderAPI } from '@networks/food/reviewsNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { FoodReviewInput, FoodReviewTag, LocalFile } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { pendingPhoto, photoFailed, photoProgress, photoUploaded, upload, type FormPhoto } from '../../../Shopping/Customer/shared/photoUploads';
import { foodReviewSerializer } from '@serializers/food/reviewSerializer';

export interface FoodRateOrderSliceState {
  code: string | null;
  foodRating: number;
  deliveryRating: number;
  tags: FoodReviewTag[];
  text: string;
  photos: FormPhoto[];
  submitted: boolean;
  status: FormStatus;
  error: ServerError;
}

const initialState: FoodRateOrderSliceState = {
  code: null,
  foodRating: 0,
  deliveryRating: 0,
  tags: [],
  text: '',
  photos: [],
  submitted: false,
  status: 'idle',
  error: NO_ERROR,
};

export const foodRateOrderSlice = createAppSlice({
  name: 'foodRateOrder',
  initialState,
  reducers: create => ({
    /** A fresh form for this order; `stars` when the order page's stars were tapped. */
    startFoodRating: create.reducer((state, action: PayloadAction<{ code: string; stars?: number }>) =>
      state.code === action.payload.code && !action.payload.stars ? state : { ...initialState, code: action.payload.code, foodRating: action.payload.stars ?? 0 },
    ),
    setFoodStars: create.reducer((state, action: PayloadAction<number>) => {
      state.foodRating = action.payload;
    }),
    setDeliveryStars: create.reducer((state, action: PayloadAction<number>) => {
      state.deliveryRating = action.payload;
    }),
    toggleFoodTag: create.reducer((state, action: PayloadAction<FoodReviewTag>) => {
      state.tags = state.tags.includes(action.payload) ? state.tags.filter(t => t !== action.payload) : [...state.tags, action.payload];
    }),
    setFoodReviewText: create.reducer((state, action: PayloadAction<string>) => {
      state.text = action.payload.slice(0, 1000);
    }),
    removeFoodReviewPhoto: create.reducer((state, action: PayloadAction<string>) => {
      state.photos = state.photos.filter(p => p.key !== action.payload);
    }),
    foodReviewPhotoProgress: create.reducer((state, action: PayloadAction<{ key: string; progress: number }>) => {
      photoProgress(state.photos, action.payload.key, action.payload.progress);
    }),
    markFoodRatingSubmitted: create.reducer(state => {
      state.submitted = true;
    }),

    addFoodReviewPhotoAsync: create.asyncThunk(
      async ({ key, file }: { key: string; file: LocalFile }, { dispatch, rejectWithValue }) => {
        try {
          return await upload(file, 'review_photo', progress => dispatch(foodRateOrderSlice.actions.foodReviewPhotoProgress({ key, progress })));
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

    submitFoodRatingAsync: create.asyncThunk(
      async ({ code, input }: { code: string; input: FoodReviewInput }, { rejectWithValue }) => {
        try {
          return required(foodReviewSerializer(await reviewFoodOrderAPI(code, input)));
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
        fulfilled: () => initialState,
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't post your review.");
        },
      },
    ),
  }),
  selectors: {
    selectFoodRateOrder: state => state,
  },
});

export const {
  startFoodRating,
  setFoodStars,
  setDeliveryStars,
  toggleFoodTag,
  setFoodReviewText,
  removeFoodReviewPhoto,
  markFoodRatingSubmitted,
  addFoodReviewPhotoAsync,
  submitFoodRatingAsync,
} = foodRateOrderSlice.actions;
export const { selectFoodRateOrder } = foodRateOrderSlice.selectors;
