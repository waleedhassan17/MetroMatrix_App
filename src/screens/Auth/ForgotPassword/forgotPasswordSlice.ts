// ═══════════════════════════════════════════════════════
// MetroMatrix — Forgot Password slice (step 1 of the FYP's three screens)
// ═══════════════════════════════════════════════════════
// POST /auth/forgot-password always answers 200 — it never reveals whether
// an account exists — and carries the resend cooldown the OTP screen starts.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { authForgotPassword } from '@networks/auth/authNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { retryAfterSerializer } from '@serializers/authSerializer';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';

export interface ForgotPasswordSliceState {
  email: string;
  touched: boolean;
  status: FormStatus;
  error: ServerError;
  /** When the code can next be re-sent — read by ResetPasswordOTP. */
  resendAvailableAt: number;
}

const initialState: ForgotPasswordSliceState = {
  email: '',
  touched: false,
  status: 'idle',
  error: NO_ERROR,
  resendAvailableAt: 0,
};

const cooldownFrom = (seconds: number) => Date.now() + seconds * 1000;

export const forgotPasswordSlice = createAppSlice({
  name: 'forgotPassword',
  initialState,
  reducers: create => ({
    setEmail: create.reducer((state, action: PayloadAction<string>) => {
      state.email = action.payload;
      state.error = NO_ERROR;
    }),
    touch: create.reducer(state => {
      state.touched = true;
    }),
    resetForgotPassword: create.reducer(() => initialState),

    /** Also the OTP screen's "Resend code". */
    requestCodeAsync: create.asyncThunk(
      async (email: string, { rejectWithValue }) => {
        try {
          return await authForgotPassword(email);
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
          state.status = 'succeeded';
          state.resendAvailableAt = cooldownFrom(action.payload);
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't send the code. Try again.");
          if (state.error.code === 'RESEND_TOO_SOON') {
            state.resendAvailableAt = cooldownFrom(retryAfterSerializer(state.error.details));
          }
        },
      },
    ),
  }),
  selectors: {
    selectForgotPassword: state => state,
  },
});

export const { setEmail, touch, resetForgotPassword, requestCodeAsync } = forgotPasswordSlice.actions;
export const { selectForgotPassword } = forgotPasswordSlice.selectors;
