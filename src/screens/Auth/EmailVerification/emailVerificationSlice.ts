// ═══════════════════════════════════════════════════════
// MetroMatrix — Email verification slice (a link, as in the FYP app)
// ═══════════════════════════════════════════════════════
// We emailed a link. The screen re-reads the account (GET /auth/me) every few
// seconds and whenever the app comes back to the foreground; the moment
// `user.isEmailVerified` is true the session is replaced and the gate moves
// on (Complete Profile for users, Personal Info for providers). That is
// "signing you in automatically". "I Verified My Email" is the same check,
// on demand.
//
// A failed check never signs anyone out (the 401 path in apiHelpers decides
// that): it only backs the polling off, 5 → 10 → 20 → 30 s.
//
// The resend countdown is an absolute time (`resendAvailableAt`) whose length
// always comes from the server's `retryAfter`.

import { createAppSlice } from '@store/createAppSlice';
import { authMe, authResendVerification } from '@networks/auth/authNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { retryAfterSerializer } from '@serializers/authSerializer';
import { setSession } from '../authSlice';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { ERROR_CODES, errorCopy } from '@networks/network/errorCodes';

/** Until the server says otherwise, the email we just sent can be re-sent in 60 s. */
export const DEFAULT_RESEND_SECONDS = 60;

/** The quiet re-check: every 5 s, backing off after failures to at most 30 s. */
export const POLL_DELAYS_MS = [5000, 10000, 20000, 30000] as const;
export const nextPollDelay = (failures: number): number =>
  POLL_DELAYS_MS[Math.min(Math.max(failures, 0), POLL_DELAYS_MS.length - 1)];

export interface EmailVerificationSliceState {
  status: FormStatus;
  /** Verified — the session is being replaced. */
  autoSignIn: boolean;
  checks: number;
  /** Consecutive failed checks; drives the back-off. */
  failures: number;
  /** A check is on the wire; another must not start. */
  inFlight: boolean;
  error: ServerError;
  resendAvailableAt: number;
  resendStatus: FormStatus;
}

const initialState: EmailVerificationSliceState = {
  status: 'idle',
  autoSignIn: false,
  checks: 0,
  failures: 0,
  inFlight: false,
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

    /** `silent`: the background re-check — never shows "not yet" or an error. */
    checkVerifiedAsync: create.asyncThunk(
      async ({ silent: _silent }: { silent: boolean }, { dispatch, rejectWithValue }) => {
        try {
          const session = await authMe();
          if (!session.user.isEmailVerified) return false;
          dispatch(setSession(session));
          return true;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        // One check at a time: the poll, the foreground re-check and the
        // button can all ask at once.
        options: {
          condition: (_arg, { getState }) =>
            !(getState() as { emailVerification: EmailVerificationSliceState }).emailVerification.inFlight,
        },
        pending: (state, action) => {
          state.inFlight = true;
          if (!action.meta.arg.silent) {
            state.status = 'loading';
            state.error = NO_ERROR;
          }
        },
        fulfilled: (state, action) => {
          state.inFlight = false;
          state.checks += 1;
          state.failures = 0;
          if (action.payload) {
            state.autoSignIn = true;
            state.status = 'succeeded';
            return;
          }
          if (!action.meta.arg.silent) {
            state.status = 'failed';
            state.error = {
              message: "We haven't seen the link opened yet. Open the email, tap the link, then try again.",
              code: ERROR_CODES.NOT_VERIFIED,
              details: null,
            };
          }
        },
        rejected: (state, action) => {
          state.inFlight = false;
          state.failures += 1;
          if (action.meta.arg.silent) return;
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't check right now. Try again.");
        },
      },
    ),

    resendAsync: create.asyncThunk(
      async (_: void, { dispatch, rejectWithValue }) => {
        try {
          const outcome = await authResendVerification();
          // Verified elsewhere in the meantime: move on instead of waiting.
          if (outcome.alreadyVerified) dispatch(setSession(await authMe()));
          return outcome;
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
          state.resendAvailableAt = cooldownFrom(action.payload.retryAfter);
        },
        rejected: (state, action) => {
          state.resendStatus = 'failed';
          const error = readRejection(action, "We couldn't resend the email. Try again.");
          state.error = { ...error, message: errorCopy(error.code, error.details) ?? error.message };
          if (error.code === ERROR_CODES.RESEND_COOLDOWN) state.resendAvailableAt = cooldownFrom(retryAfterSerializer(error.details));
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
