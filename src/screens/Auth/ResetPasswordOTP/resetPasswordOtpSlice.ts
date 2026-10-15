// ═══════════════════════════════════════════════════════
// MetroMatrix — Reset Password OTP slice (step 2)
// ═══════════════════════════════════════════════════════
// POST /auth/verify-reset-otp → a single-use resetToken for step 3, kept
// here rather than in a route param so it never reaches a web URL. Wrong
// codes count down `attemptsLeft`; OTP_LOCKED ends the attempt.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { authVerifyResetOtp } from '@networks/auth/authNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';

export interface ResetPasswordOtpSliceState {
  code: string;
  /** Step 3's single-use token; '' until a code is accepted. */
  resetToken: string;
  attemptsLeft: number | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: ResetPasswordOtpSliceState = {
  code: '',
  resetToken: '',
  attemptsLeft: null,
  status: 'idle',
  error: NO_ERROR,
};

export const resetPasswordOtpSlice = createAppSlice({
  name: 'resetPasswordOtp',
  initialState,
  reducers: create => ({
    setCode: create.reducer((state, action: PayloadAction<string>) => {
      state.code = action.payload;
      if (state.status === 'failed') state.error = NO_ERROR;
    }),
    resetOtp: create.reducer(() => initialState),

    verifyCodeAsync: create.asyncThunk(
      async ({ email, code }: { email: string; code: string }, { rejectWithValue }) => {
        try {
          return await authVerifyResetOtp(email, code);
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
          state.error = readRejection(action, "That code didn't work. Try again.");
          state.code = '';
          const left = state.error.details?.attemptsLeft;
          if (typeof left === 'number') state.attemptsLeft = left;
          if (state.error.code === 'OTP_LOCKED') state.attemptsLeft = 0;
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
