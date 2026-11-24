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
// always comes from the server's `retryAfter`. It starts when an email was just
// sent (sign-up, a resend) or the server says to wait — not on every visit.
//
// "I Verified My Email" while a background check is on the wire is not
// dropped: that check reports to the person instead (`manual`).
//
// A resend that timed out keeps its Idempotency-Key, so tapping again replays
// the first answer (the API may well have sent it) rather than hitting the
// cooldown and retiring the link just sent.

import { createAppSlice } from '../../store/createAppSlice';
import { me } from '../../networks/authcalls/me';
import { resendVerification } from '../../networks/authcalls/verifyEmail';
import { toRejectedValue, ERROR_CODES, errorCopy, retryAfterOf } from '../../networks/network/network';
import { retryAfterSerializer } from '../../serializers/authSerializer';
import { setSession } from '../../store/authSlice';
import { newUuid } from '../../utils/ids/ids';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { stillSignedIn } from '../shared/sessionGuard';

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
  /** The person tapped "I Verified My Email" while a quiet check was on the wire: it reports to them. */
  manual: boolean;
  error: ServerError;
  resendAvailableAt: number;
  resendStatus: FormStatus;
  /** Kept across a resend that never answered, so the retry replays it. */
  resendKey: string | null;
}

const initialState: EmailVerificationSliceState = {
  status: 'idle',
  autoSignIn: false,
  checks: 0,
  failures: 0,
  inFlight: false,
  manual: false,
  error: NO_ERROR,
  resendAvailableAt: 0,
  resendStatus: 'idle',
  resendKey: null,
};

const cooldownFrom = (seconds: number) => Date.now() + seconds * 1000;

export const emailVerificationSlice = createAppSlice({
  name: 'emailVerification',
  initialState,
  reducers: create => ({
    /** An email was just sent (sign-up): Resend waits the usual minute. */
    startCooldownIfIdle: create.reducer(state => {
      if (!state.resendAvailableAt) state.resendAvailableAt = cooldownFrom(DEFAULT_RESEND_SECONDS);
    }),
    resetVerification: create.reducer(() => initialState),
    /** "I Verified My Email" while a quiet check is on the wire: show its outcome. */
    markManualCheck: create.reducer(state => {
      state.manual = true;
      state.status = 'loading';
      state.error = NO_ERROR;
    }),

    /** `silent`: the background re-check — never shows "not yet" or an error. */
    checkVerifiedAsync: create.asyncThunk(
      async ({ silent: _silent }: { silent: boolean }, { dispatch, rejectWithValue }) => {
        try {
          const session = await me();
          if (!session.user.isEmailVerified) return false;
          // Signed out while this was on the wire: don't bring the session back.
          if (!(await stillSignedIn())) return false;
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
          const silent = action.meta.arg.silent && !state.manual;
          state.inFlight = false;
          state.manual = false;
          state.checks += 1;
          state.failures = 0;
          if (action.payload) {
            state.autoSignIn = true;
            state.status = 'succeeded';
            return;
          }
          if (!silent) {
            state.status = 'failed';
            state.error = {
              message: "We haven't seen the link opened yet. Open the email, tap the link, then try again.",
              code: ERROR_CODES.NOT_VERIFIED,
              details: null,
            };
          }
        },
        rejected: (state, action) => {
          // The condition refused a second check: the one on the wire reports instead.
          if (action.meta.condition) return;
          const silent = action.meta.arg.silent && !state.manual;
          state.inFlight = false;
          state.manual = false;
          state.failures += 1;
          if (silent) return;
          state.status = 'failed';
          const error = readRejection(action, "We couldn't check right now. Try again.");
          state.error = { ...error, message: errorCopy(error.code, error.details) ?? error.message };
        },
      },
    ),

    resendAsync: create.asyncThunk(
      async ({ key }: { key: string }, { dispatch, rejectWithValue }) => {
        try {
          const outcome = await resendVerification(key);
          // Verified elsewhere in the meantime: move on instead of waiting. If
          // that read fails, the next quiet check moves on just the same.
          if (outcome.alreadyVerified) {
            try {
              const session = await me();
              if (await stillSignedIn()) dispatch(setSession(session));
            } catch {
              /* the poll picks it up */
            }
          }
          return outcome;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.resendStatus = 'loading';
          state.resendKey = action.meta.arg.key;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.resendStatus = 'succeeded';
          state.resendKey = null;
          state.resendAvailableAt = cooldownFrom(action.payload.retryAfter);
        },
        rejected: (state, action) => {
          state.resendStatus = 'failed';
          const error = readRejection(action, "We couldn't resend the email. Try again.");
          state.error = { ...error, message: errorCopy(error.code, error.details) ?? error.message };
          // No answer: it may have been sent, so the retry replays this key.
          if (error.code !== ERROR_CODES.NETWORK_ERROR) state.resendKey = null;
          if (error.code === ERROR_CODES.RESEND_COOLDOWN) state.resendAvailableAt = cooldownFrom(retryAfterSerializer(error.details));
          if (error.code === ERROR_CODES.RATE_LIMITED) {
            state.resendAvailableAt = cooldownFrom(retryAfterOf(error.details) ?? DEFAULT_RESEND_SECONDS);
          }
        },
      },
    ),
  }),
  selectors: {
    selectEmailVerification: state => state,
  },
});

export const { startCooldownIfIdle, resetVerification, markManualCheck, checkVerifiedAsync, resendAsync } =
  emailVerificationSlice.actions;
export const { selectEmailVerification } = emailVerificationSlice.selectors;

/** The key for the next resend: the one a resend that never answered kept, else a fresh one. */
export const nextResendKey = (state: EmailVerificationSliceState): string => state.resendKey ?? newUuid();
