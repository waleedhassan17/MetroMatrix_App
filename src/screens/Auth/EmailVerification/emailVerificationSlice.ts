// ═══════════════════════════════════════════════════════
// MetroMatrix — Email verification slice (a link, as in the FYP app)
// ═══════════════════════════════════════════════════════
// We emailed a link. "I Verified My Email" (and a quiet re-check while the
// screen is open) asks the server whether it was opened; once it was,
// /auth/me is re-read and the gate moves on — Complete Profile for users,
// Personal Info for providers. "Signing you in automatically..." is that.
//
// The resend countdown is an absolute time (`resendAvailableAt`) whose length
// always comes from the server's `retryAfter`.

import { createAppSlice } from '@store/createAppSlice';
import { authMe, authResendVerification, authVerificationStatus } from '@networks/auth/authNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { retryAfterSerializer } from '@serializers/authSerializer';
import { setSession } from '../authSlice';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';

/** Until the server says otherwise, the email we just sent can be re-sent in 60 s. */
export const DEFAULT_RESEND_SECONDS = 60;

export interface EmailVerificationSliceState {
  status: FormStatus;
  /** Verified — the session is being re-read. */
  autoSignIn: boolean;
  checks: number;
  error: ServerError;
  resendAvailableAt: number;
  resendStatus: FormStatus;
}

const initialState: EmailVerificationSliceState = {
  status: 'idle',
  autoSignIn: false,
  checks: 0,
  error: NO_ERROR,
  resendAvailableAt: 0,
  resendStatus: 'idle',
};

const cooldownFrom = (seconds: number) => Date.now() + seconds * 1000;

export const emailVerificationSlice = createAppSlice({
  name: 'emailVerification',
  initialState,
  reducers: create => ({
    startCooldownIfIdle: create.reducer(state => {
      if (!state.resendAvailableAt) state.resendAvailableAt = cooldownFrom(DEFAULT_RESEND_SECONDS);
    }),
    resetVerification: create.reducer(() => initialState),

    /** `silent`: the background re-check — never shows "not yet". */
    checkVerifiedAsync: create.asyncThunk(
      async ({ silent: _silent }: { silent: boolean }, { dispatch, rejectWithValue }) => {
        try {
          const verified = await authVerificationStatus();
          if (!verified) return false;
          dispatch(setSession(await authMe()));
          return true;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          if (!action.meta.arg.silent) {
            state.status = 'loading';
            state.error = NO_ERROR;
          }
        },
        fulfilled: (state, action) => {
          state.checks += 1;
          if (action.payload) {
            state.autoSignIn = true;
            state.status = 'succeeded';
            return;
          }
          if (!action.meta.arg.silent) {
            state.status = 'failed';
            state.error = {
              message: "We haven't seen the link opened yet. Open the email, tap the link, then try again.",
              code: 'NOT_VERIFIED',
              details: null,
            };
          }
        },
        rejected: (state, action) => {
          if (action.meta.arg.silent) return;
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't check right now. Try again.");
        },
      },
    ),

    resendAsync: create.asyncThunk(
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
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.resendStatus = 'succeeded';
          state.resendAvailableAt = cooldownFrom(action.payload);
        },
        rejected: (state, action) => {
          state.resendStatus = 'failed';
          const error = readRejection(action, "We couldn't resend the email. Try again.");
          state.error = error;
          if (error.code === 'RESEND_TOO_SOON') state.resendAvailableAt = cooldownFrom(retryAfterSerializer(error.details));
        },
      },
    ),
  }),
  selectors: {
    selectEmailVerification: state => state,
  },
});

export const { startCooldownIfIdle, resetVerification, checkVerifiedAsync, resendAsync } = emailVerificationSlice.actions;
export const { selectEmailVerification } = emailVerificationSlice.selectors;
