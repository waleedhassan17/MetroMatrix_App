// ═══════════════════════════════════════════════════════
// MetroMatrix — Verify Success slice (the email link's landing)
// ═══════════════════════════════════════════════════════
// Two links open here:
//   metromatrix://verify-email?token=…   the email's "Open in the app" link:
//                                        the token is spent (POST /auth/verify-email)
//   metromatrix://verify-email?verified=1 the API's web page, after it spent
//                                        the token itself: nothing to spend
// (verify-success?… is rewritten to verify-email by the linking config.)
//
// Signed in: the account is re-read, so the gate moves on. A token that fails
// is checked against the account first — the web page or a mail scanner may
// have spent it already — and only reported when the address really is
// unverified. Signed out: "Email verified, sign in to continue" (a provider
// is sent to the provider sign-in).
//
// Nobody is left stuck (the 2026-11-24 QA):
//   • the link never got an answer → "Try again" spends the same token again;
//   • verified, but the account couldn't be re-read → "Continue" re-reads it;
//   • ?verified=1 while the account still reads unverified → "Checking", not
//     "verified", and "Continue" looks again.

import { createAppSlice } from '../../store/createAppSlice';
import { me } from '../../networks/authcalls/me';
import { verifyEmail } from '../../networks/authcalls/verifyEmail';
import { getAccessToken } from '../../utils/storage_utils/storageUtils';
import { ERROR_CODES, errorCopy, toRejectedValue } from '../../networks/network/network';
import { setSession } from '../../store/authSlice';
import type { UserRole } from '../../models/auth';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { stillSignedIn } from '../shared/sessionGuard';

export interface VerifyLinkArgs {
  token?: string;
  /** The web page already verified the address. */
  verified?: boolean;
}

/**
 * How a verified link landed:
 *   done        signed out: verified, sign in to continue
 *   moved       signed in: the session has the verified account; the gate moves on
 *   unreadable  signed in, verified, but the account couldn't be read just now
 *   unconfirmed signed in, but the account still reads unverified
 */
export type VerifyOutcome = 'done' | 'moved' | 'unreadable' | 'unconfirmed';

export interface VerifySuccessSliceState {
  status: FormStatus;
  signedIn: boolean;
  outcome: VerifyOutcome | null;
  /** Whose address it was (from the spent token), for the right sign-in door. */
  role: UserRole | null;
  /** The link failed for lack of an answer: "Try again" spends the same token. */
  retryable: boolean;
  /** "Continue" is re-reading the account. */
  continuing: boolean;
  error: ServerError;
}

const initialState: VerifySuccessSliceState = {
  status: 'idle',
  signedIn: false,
  outcome: null,
  role: null,
  retryable: false,
  continuing: false,
  error: NO_ERROR,
};

/** Signed in: the fresh account, or null when it can't be read. */
const reReadSession = async () => {
  try {
    return await me();
  } catch {
    return null;
  }
};

/** Re-reads the account and, once it reads verified, hands it to the gate. */
const applyVerified = async (dispatch: (a: unknown) => unknown): Promise<Exclude<VerifyOutcome, 'done'>> => {
  const session = await reReadSession();
  if (!session) return 'unreadable';
  if (!session.user.isEmailVerified) return 'unconfirmed';
  // Signed out while this was on the wire: don't bring the session back.
  if (!(await stillSignedIn())) return 'unreadable';
  dispatch(setSession(session));
  return 'moved';
};

export const verifySuccessSlice = createAppSlice({
  name: 'verifySuccess',
  initialState,
  reducers: create => ({
    verifyLinkAsync: create.asyncThunk(
      async ({ token, verified }: VerifyLinkArgs, { dispatch, rejectWithValue }) => {
        const signedIn = !!(await getAccessToken());
        try {
          let role: UserRole | null = null;
          if (token) role = (await verifyEmail(token)).user.role ?? null;
          else if (!verified) throw new Error('This verification link is incomplete. Request a new one.');
          if (!signedIn) return { signedIn, outcome: 'done' as VerifyOutcome, role };
          return { signedIn, outcome: (await applyVerified(dispatch)) as VerifyOutcome, role };
        } catch (e) {
          // Before saying it failed: is the address verified anyway?
          if (signedIn) {
            const session = await reReadSession();
            if (session?.user.isEmailVerified && (await stillSignedIn())) {
              dispatch(setSession(session));
              return { signedIn, outcome: 'moved' as VerifyOutcome, role: session.user.role ?? null };
            }
          }
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.retryable = false;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.signedIn = action.payload.signedIn;
          state.outcome = action.payload.outcome;
          state.role = action.payload.role;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          const error = readRejection(action, 'This link has expired or been replaced. Open the app and tap Resend.');
          state.retryable = error.code === ERROR_CODES.NETWORK_ERROR;
          state.error = { ...error, message: errorCopy(error.code, error.details) ?? error.message };
        },
      },
    ),

    /** "Continue": read the account again (it was unreadable, or not yet verified). */
    continueAsync: create.asyncThunk(async (_: void, { dispatch }) => applyVerified(dispatch), {
      pending: state => {
        state.continuing = true;
      },
      fulfilled: (state, action) => {
        state.continuing = false;
        state.outcome = action.payload;
      },
      rejected: state => {
        state.continuing = false;
      },
    }),
  }),
  selectors: {
    selectVerifySuccess: state => state,
  },
});

export const { verifyLinkAsync, continueAsync } = verifySuccessSlice.actions;
export const { selectVerifySuccess } = verifySuccessSlice.selectors;
