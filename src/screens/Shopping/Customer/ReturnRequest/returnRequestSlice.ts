// ═══════════════════════════════════════════════════════
// MetroMatrix — Return request slice
// ═══════════════════════════════════════════════════════
// Which items (and how many of each), why, what happened, and photos.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { requestReturnAPI } from '@networks/shopping/returnsNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { LocalFile, ReturnInput, ReturnReason } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { pendingPhoto, photoFailed, photoProgress, photoUploaded, upload, type FormPhoto } from '../shared/photoUploads';
import { returnSerializer } from '@serializers/shopping/orderSerializer';

export interface ReturnRequestSliceState {
  orderId: string | null;
  /** orderItemId → how many to return (0 = not returning it). */
  quantities: Record<string, number>;
  reason: ReturnReason | null;
  details: string;
  photos: FormPhoto[];
  submitted: boolean;
  status: FormStatus;
  error: ServerError;
}

const initialState: ReturnRequestSliceState = {
  orderId: null,
  quantities: {},
  reason: null,
  details: '',
  photos: [],
  submitted: false,
  status: 'idle',
  error: NO_ERROR,
};

export const returnRequestSlice = createAppSlice({
  name: 'returnRequest',
  initialState,
  reducers: create => ({
    startReturn: create.reducer((_state, action: PayloadAction<string>) => ({ ...initialState, orderId: action.payload })),
    setReturnQuantity: create.reducer((state, action: PayloadAction<{ itemId: string; quantity: number }>) => {
      state.quantities[action.payload.itemId] = Math.max(0, action.payload.quantity);
    }),
    setReturnReason: create.reducer((state, action: PayloadAction<ReturnReason>) => {
      state.reason = action.payload;
    }),
    setReturnDetails: create.reducer((state, action: PayloadAction<string>) => {
      state.details = action.payload.slice(0, 1000);
    }),
    removeReturnPhoto: create.reducer((state, action: PayloadAction<string>) => {
      state.photos = state.photos.filter(p => p.key !== action.payload);
    }),
    returnPhotoProgress: create.reducer((state, action: PayloadAction<{ key: string; progress: number }>) => {
      photoProgress(state.photos, action.payload.key, action.payload.progress);
    }),
    markReturnSubmitted: create.reducer(state => {
      state.submitted = true;
    }),

    addReturnPhotoAsync: create.asyncThunk(
      async ({ key, file }: { key: string; file: LocalFile }, { dispatch, rejectWithValue }) => {
        try {
          return await upload(file, 'return_photo', progress => dispatch(returnRequestSlice.actions.returnPhotoProgress({ key, progress })));
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

    submitReturnAsync: create.asyncThunk(
      async ({ orderId, input }: { orderId: string; input: ReturnInput }, { rejectWithValue }) => {
        try {
          return required(returnSerializer(await requestReturnAPI(orderId, input)));
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
          state.error = readRejection(action, "We couldn't send your return request.");
        },
      },
    ),
  }),
  selectors: {
    selectReturnRequest: state => state,
  },
});

export const {
  startReturn,
  setReturnQuantity,
  setReturnReason,
  setReturnDetails,
  removeReturnPhoto,
  markReturnSubmitted,
  addReturnPhotoAsync,
  submitReturnAsync,
} = returnRequestSlice.actions;
export const { selectReturnRequest } = returnRequestSlice.selectors;
