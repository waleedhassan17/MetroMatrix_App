// ═══════════════════════════════════════════════════════
// MetroMatrix — Forgot password slice (3 steps, one screen)
// ═══════════════════════════════════════════════════════
//   email  → POST /auth/forgot-password       (always 200 — never reveals
//                                              whether an account exists)
//   otp    → POST /auth/verify-reset-otp      → a single-use resetToken
//   reset  → POST /auth/reset-password        → done; sign in again
// Unlike FinMatrix, every step is a thunk here: the screen never calls a
// network function directly.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { authForgotPassword, authResetPassword, authVerifyResetOtp } from '@networks/auth/authNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { retryAfterSerializer } from '@serializers/authSerializer';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import type { Touched } from '@utils/formErrors';

export type ForgotStep = 'email' | 'otp' | 'reset' | 'done';
type Field = 'email' | 'password' | 'confirmPassword';

export interface ForgotPasswordSliceState {
  step: ForgotStep;
  email: string;
  code: string;
  password: string;
  confirmPassword: string;
  resetToken: string;
  touched: Touched<Field>;
  attemptsLeft: number | null;
  resendAvailableAt: number;
  status: FormStatus;
  error: ServerError;
}

const initialState: ForgotPasswordSliceState = {
  step: 'email',
  email: '',
  code: '',
  password: '',
  confirmPassword: '',
  resetToken: '',
  touched: {},
  attemptsLeft: null,
  resendAvailableAt: 0,
  status: 'idle',
  error: NO_ERROR,
};

const cooldownFrom = (seconds: number) => Date.now() + seconds * 1000;

const pending = (state: ForgotPasswordSliceState) => {
  state.status = 'loading';
  state.error = NO_ERROR;
};

export const forgotPasswordSlice = createAppSlice({
  name: 'forgotPassword',
  initialState,
  reducers: create => ({
    setEmail: create.reducer((state, action: PayloadAction<string>) => {
      state.email = action.payload;
      state.error = NO_ERROR;
    }),
    setCode: create.reducer((state, action: PayloadAction<string>) => {
      state.code = action.payload;
    }),
    setPassword: create.reducer((state, action: PayloadAction<string>) => {
      state.password = action.payload;
    }),
    setConfirmPassword: create.reducer((state, action: PayloadAction<string>) => {
      state.confirmPassword = action.payload;
    }),
    touch: create.reducer((state, action: PayloadAction<Field>) => {
      state.touched[action.payload] = true;
    }),
    /** Back one step (otp → email, reset → otp). */
    stepBack: create.reducer(state => {
      state.error = NO_ERROR;
      if (state.step === 'reset') state.step = 'otp';
      else if (state.step === 'otp') {
        state.step = 'email';
        state.code = '';
        state.attemptsLeft = null;
      }
    }),
    /** A reset link carried the email and code: jump to the OTP step. */
    prefillFromLink: create.reducer((state, action: PayloadAction<{ email?: string; code?: string }>) => {
      if (action.payload.email) state.email = action.payload.email;
      if (action.payload.code && action.payload.email) {
        state.code = action.payload.code;
        state.step = 'otp';
      }
    }),
    resetForgotPassword: create.reducer(() => initialState),

    requestCodeAsync: create.asyncThunk(
      async (email: string, { rejectWithValue }) => {
        try {
          return await authForgotPassword(email);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending,
        fulfilled: (state, action) => {
          state.status = 'idle';
          state.step = 'otp';
          state.code = '';
          state.attemptsLeft = null;
          state.resendAvailableAt = cooldownFrom(action.payload);
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't send the code. Try again.");
          if (state.error.code === 'RESEND_TOO_SOON') {
            state.resendAvailableAt = cooldownFrom(retryAfterSerializer(state.error.details));
            state.step = 'otp';
          }
        },
      },
    ),

    verifyCodeAsync: create.asyncThunk(
      async ({ email, code }: { email: string; code: string }, { rejectWithValue }) => {
        try {
          return await authVerifyResetOtp(email, code);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending,
        fulfilled: (state, action) => {
          state.status = 'idle';
          state.resetToken = action.payload;
          state.step = 'reset';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "That code didn't work. Try again.");
          state.code = '';
          const left = state.error.details?.attemptsLeft;
          if (typeof left === 'number') state.attemptsLeft = left;
          if (state.error.code === 'OTP_LOCKED') state.attemptsLeft = 0;
        },
      },
    ),

    resetPasswordAsync: create.asyncThunk(
      async ({ resetToken, password }: { resetToken: string; password: string }, { rejectWithValue }) => {
        try {
          await authResetPassword(resetToken, password);
          return true;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending,
        fulfilled: state => {
          state.status = 'succeeded';
          state.step = 'done';
          state.password = '';
          state.confirmPassword = '';
          state.resetToken = '';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't reset your password. Try again.");
          // An expired or spent token cannot be retried: start the code again.
          if (state.error.code === 'RESET_TOKEN_INVALID') {
            state.step = 'otp';
            state.code = '';
          }
        },
      },
    ),
  }),

  selectors: {
    selectForgotPassword: state => state,
  },
});

export const {
  setEmail,
  setCode,
  setPassword,
  setConfirmPassword,
  touch,
  stepBack,
  prefillFromLink,
  resetForgotPassword,
  requestCodeAsync,
  verifyCodeAsync,
  resetPasswordAsync,
} = forgotPasswordSlice.actions;

export const { selectForgotPassword } = forgotPasswordSlice.selectors;
