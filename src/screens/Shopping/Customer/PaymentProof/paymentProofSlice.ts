// ═══════════════════════════════════════════════════════
// MetroMatrix — "I've paid": the transfer's transaction ID (+ screenshot)
// ═══════════════════════════════════════════════════════
// One flow for every service: a shop order's transfer to the store, an
// appointment's transfer to the doctor, or a Food order's to the kitchen.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { submitPaymentProofAPI } from '@networks/shopping/ordersNetwork';
import { submitAppointmentPaymentProof } from '@networks/health/appointmentsNetwork';
import { submitFoodPaymentProof } from '@networks/food/ordersNetwork';
import { submitReservationProof } from '@networks/food/surplusNetwork';
import { submitTiffinProof } from '@networks/foodGrowth/tiffinNetwork';
import { submitAdvanceProof } from '@networks/foodGrowth/cateringNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import { normaliseTransactionId } from '@models/shopping/paymentProofModel';
import type { LocalFile } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { pendingPhoto, photoFailed, photoKey, photoProgress, photoUploaded, upload, type FormPhoto } from '../shared/photoUploads';
import { orderGroupSerializer } from '@serializers/shopping/orderSerializer';

export interface PaymentProofSliceState {
  /** The order or appointment being paid for. */
  orderId: string | null;
  transactionId: string;
  touched: boolean;
  photos: FormPhoto[];
  status: FormStatus;
  error: ServerError;
}

const initialState: PaymentProofSliceState = { orderId: null, transactionId: '', touched: false, photos: [], status: 'idle', error: NO_ERROR };

export const paymentProofSlice = createAppSlice({
  name: 'paymentProof',
  initialState,
  reducers: create => ({
    startPaymentProof: create.reducer((_state, action: PayloadAction<string>) => ({ ...initialState, orderId: action.payload })),
    setTransactionId: create.reducer((state, action: PayloadAction<string>) => {
      state.transactionId = action.payload;
    }),
    touchTransactionId: create.reducer(state => {
      state.touched = true;
    }),
    removeProofPhoto: create.reducer((state, action: PayloadAction<string>) => {
      state.photos = state.photos.filter(p => p.key !== action.payload);
    }),
    proofPhotoProgress: create.reducer((state, action: PayloadAction<{ key: string; progress: number }>) => {
      photoProgress(state.photos, action.payload.key, action.payload.progress);
    }),

    addProofPhotoAsync: create.asyncThunk(
      async ({ key, file }: { key: string; file: LocalFile }, { dispatch, rejectWithValue }) => {
        try {
          return await upload(file, 'payment_proof', progress => dispatch(paymentProofSlice.actions.proofPhotoProgress({ key, progress })));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.photos = [pendingPhoto(action.meta.arg.key, action.meta.arg.file)];
        },
        fulfilled: (state, action) => {
          photoUploaded(state.photos, action.meta.arg.key, action.payload.url);
        },
        rejected: (state, action) => {
          state.photos = photoFailed(state.photos, action.meta.arg.key);
          state.error = readRejection(action, "The screenshot didn't upload. Try again.");
        },
      },
    ),

    submitPaymentProofAsync: create.asyncThunk(
      async ({ orderId, transactionId, imageUrl }: { orderId: string; transactionId: string; imageUrl: string | null }, { rejectWithValue }) => {
        try {
          return required(orderGroupSerializer(await submitPaymentProofAPI(orderId, { transactionId: normaliseTransactionId(transactionId), imageUrl })));
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
          state.error = readRejection(action, "We couldn't send that. Check the ID and try again.");
        },
      },
    ),

    // POST /health/appointments/:code/payment-proof (API_HEALTH.md §4.2).
    submitAppointmentProofAsync: create.asyncThunk(
      async ({ code, transactionId, imageUrl }: { code: string; transactionId: string; imageUrl: string | null }, { rejectWithValue }) => {
        try {
          return await submitAppointmentPaymentProof(code, { transactionId: normaliseTransactionId(transactionId), imageUrl });
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
          state.error = readRejection(action, "We couldn't send that. Check the ID and try again.");
        },
      },
    ),

    // POST /food/orders/:code/payment-proof (the kitchen confirms it on its board).
    submitFoodProofAsync: create.asyncThunk(
      async ({ code, transactionId, imageUrl }: { code: string; transactionId: string; imageUrl: string | null }, { rejectWithValue }) => {
        try {
          return await submitFoodPaymentProof(code, { paymentRef: normaliseTransactionId(transactionId), proofUrl: imageUrl });
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
          state.error = readRejection(action, "We couldn't send that. Check the ID and try again.");
        },
      },
    ),

    // POST /food/surplus/reservations/:code/payment-proof (a Bachat Box; TODO(API_KITCHEN)).
    submitSurplusProofAsync: create.asyncThunk(
      async ({ code, transactionId, imageUrl }: { code: string; transactionId: string; imageUrl: string | null }, { rejectWithValue }) => {
        try {
          return await submitReservationProof(code, { transactionId: normaliseTransactionId(transactionId), imageUrl });
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
          state.error = readRejection(action, "We couldn't send that. Check the ID and try again.");
        },
      },
    ),
    // POST /food/tiffin/periods/:id/payment-proof (a tiffin period; TODO(API_KITCHEN)).
    submitTiffinProofAsync: create.asyncThunk(
      async ({ periodId, transactionId, imageUrl }: { periodId: string; transactionId: string; imageUrl: string | null }, { rejectWithValue }) => {
        try {
          return await submitTiffinProof(periodId, { transactionId: normaliseTransactionId(transactionId), imageUrl });
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
          state.error = readRejection(action, "We couldn't send that. Check the ID and try again.");
        },
      },
    ),
    // POST /food/catering/requests/:code/advance-proof (a dawat's advance; TODO(API_KITCHEN)).
    submitAdvanceProofAsync: create.asyncThunk(
      async ({ code, transactionId, imageUrl }: { code: string; transactionId: string; imageUrl: string | null }, { rejectWithValue }) => {
        try {
          return await submitAdvanceProof(code, { transactionId: normaliseTransactionId(transactionId), imageUrl });
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
          state.error = readRejection(action, "We couldn't send that. Check the ID and try again.");
        },
      },
    ),
  }),
  selectors: {
    selectPaymentProof: state => state,
  },
});

export { photoKey };
export const {
  startPaymentProof,
  setTransactionId,
  touchTransactionId,
  removeProofPhoto,
  addProofPhotoAsync,
  submitPaymentProofAsync,
  submitAppointmentProofAsync,
  submitFoodProofAsync,
  submitSurplusProofAsync,
  submitTiffinProofAsync,
  submitAdvanceProofAsync,
} = paymentProofSlice.actions;
export const { selectPaymentProof } = paymentProofSlice.selectors;
