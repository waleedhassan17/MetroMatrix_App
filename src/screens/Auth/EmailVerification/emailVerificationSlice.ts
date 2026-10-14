// ═══════════════════════════════════════════════════════
// MetroMatrix — Email verification slice
// ═══════════════════════════════════════════════════════
// Verify the 6-digit code, then re-read /auth/me so the gate sees the
// verified user and routes on (customer app, partner setup, …).
//
// The resend countdown is an absolute time (`resendAvailableAt`), not a
// ticking counter in Redux: the screen derives the seconds left, and the
// value survives a re-render or a trip to the background unchanged. Its
// length always comes from the server's `retryAfter`.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { authMe, authResendVerification, authVerifyEmail } from '@networks/auth/authNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { retryAfterSerializer } from '@serializers/authSerializer';
import { setSession } from '../authSlice';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';

/** Until the server says otherwise, the code we just sent can be re-sent in 60 s. */
export const DEFAULT_RESEND_SECONDS = 60;

export interface EmailVerificationSliceState {
  code: string;
  status: FormStatus;
  error: ServerError;
  attemptsLeft: number | null;
  locked: boolean;
  resendAvailableAt: number;
  resendStatus: FormStatus;
  resentAt: number;
}

const initialState: EmailVerificationSliceState = {
  code: '',
  status: 'idle',
  error: NO_ERROR,
  attemptsLeft: null,
  locked: false,
  resendAvailableAt: 0,
  resendStatus: 'idle',
  resentAt: 0,
};

const cooldownFrom = (seconds: number) => Date.now() + seconds * 1000;

export const emailVerificationSlice = createAppSlice({
  name: 'emailVerification',
  initialState,
  reducers: create => ({
    setCode: create.reducer((state, action: PayloadAction<string>) => {
      state.code = action.payload;
      if (state.status === 'failed') state.error = NO_ERROR;
    }),
    /** Starts the first countdown when the screen opens (code just sent). */
    startCooldownIfIdle: create.reducer(state => {
      if (!state.resendAvailableAt) state.resendAvailableAt = cooldownFrom(DEFAULT_RESEND_SECONDS);
    }),
    resetVerification: create.reducer(() => initialState),

    verifyEmailAsync: create.asyncThunk(
      async (code: string, { dispatch, rejectWithValue }) => {
        try {
          await authVerifyEmail(code);
          const session = await authMe();
          dispatch(setSession(session));
          return true;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.status = 'succeeded';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          const error = readRejection(action, "That code didn't work. Try again.");
          state.error = error;
          state.code = '';
          const left = error.details?.attemptsLeft;
          if (typeof left === 'number') state.attemptsLeft = left;
          if (error.code === 'OTP_LOCKED' || left === 0) {
            state.locked = true;
            state.attemptsLeft = 0;
            state.resendAvailableAt = cooldownFrom(retryAfterSerializer(error.details, 0));
          }
        },
      },
    ),

    resendCodeAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await authResendVerification();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.resendStatus = 'loading';
        },
        fulfilled: (state, action) => {
          state.resendStatus = 'succeeded';
          state.resendAvailableAt = cooldownFrom(action.payload);
          state.resentAt = Date.now();
          // A fresh code resets the attempt budget and lifts a lock.
          state.locked = false;
          state.attemptsLeft = null;
          state.error = NO_ERROR;
          state.code = '';
        },
        rejected: (state, action) => {
          state.resendStatus = 'failed';
          const error = readRejection(action, "We couldn't resend the code. Try again.");
          state.error = error;
          if (error.code === 'RESEND_TOO_SOON') {
            state.resendAvailableAt = cooldownFrom(retryAfterSerializer(error.details));
          }
        },
      },
    ),
  }),

  selectors: {
    selectEmailVerification: state => state,
  },
});

export const { setCode, startCooldownIfIdle, resetVerification, verifyEmailAsync, resendCodeAsync } =
  emailVerificationSlice.actions;

export const { selectEmailVerification } = emailVerificationSlice.selectors;
