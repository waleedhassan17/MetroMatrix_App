// ═══════════════════════════════════════════════════════
// MetroMatrix — Reset Password OTP slice (step 2)
// ═══════════════════════════════════════════════════════
// POST /auth/verify-otp { email, otp } → a single-use resetToken for step 3,
// kept here rather than in a route param so it never reaches a web URL.
//   OTP_INVALID  wrong code: `details.attemptsLeft` counts down
//   OTP_EXPIRED  older than 10 minutes  ┐ only a new code helps:
//   OTP_LOCKED   5 wrong attempts        ┘ the screen offers Resend
// The API answers a plain OTP_INVALID (no attemptsLeft) when it won't say
// more, e.g. for an unknown address.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { verifyResetOtp } from '../../networks/authcalls/forgotPassword';
import { toRejectedValue, ERROR_CODES } from '../../networks/network/network';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';

export interface ResetPasswordOtpSliceState {
  code: string;
  /** Step 3's single-use token; '' until a code is accepted. */
  resetToken: string;
  attemptsLeft: number | null;
  /** This code can't succeed any more (expired or locked): only Resend helps. */
  needsNewCode: boolean;
  status: FormStatus;
  error: ServerError;
}

const initialState: ResetPasswordOtpSliceState = {
  code: '',
  resetToken: '',
  attemptsLeft: null,
  needsNewCode: false,
  status: 'idle',
  error: NO_ERROR,
};

const COPY: Record<string, string> = {
  [ERROR_CODES.OTP_INVALID]: "That code isn't right.",
  [ERROR_CODES.OTP_EXPIRED]: 'This code has expired. Request a new one.',
  [ERROR_CODES.OTP_LOCKED]: 'Too many attempts. Request a new code to try again.',
};

export const resetPasswordOtpSlice = createAppSlice({
  name: 'resetPasswordOtp',
  initialState,
  reducers: create => ({
    setCode: create.reducer((state, action: PayloadAction<string>) => {
      state.code = action.payload;
      if (state.status === 'failed' && !state.needsNewCode) state.error = NO_ERROR;
    }),
    resetOtp: create.reducer(() => initialState),

    verifyCodeAsync: create.asyncThunk(
      async ({ email, code }: { email: string; code: string }, { rejectWithValue }) => {
        try {
          return await verifyResetOtp(email, code);
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
          state.code = '';
          state.resetToken = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          const error = readRejection(action, "That code didn't work. Try again.");
          state.error = error.code && COPY[error.code] ? { ...error, message: COPY[error.code] } : error;
          state.code = '';
          const left = error.details?.attemptsLeft;
          if (typeof left === 'number') state.attemptsLeft = left;
          if (error.code === ERROR_CODES.OTP_LOCKED) state.attemptsLeft = 0;
          state.needsNewCode = error.code === ERROR_CODES.OTP_LOCKED || error.code === ERROR_CODES.OTP_EXPIRED;
        },
      },
    ),
  }),
  selectors: {
    selectResetPasswordOtp: state => state,
    selectResetToken: state => state.resetToken,
  },
});

export const { setCode, resetOtp, verifyCodeAsync } = resetPasswordOtpSlice.actions;
export const { selectResetPasswordOtp, selectResetToken } = resetPasswordOtpSlice.selectors;
