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
// unverified. Signed out: "Email verified, sign in to continue".

import { createAppSlice } from '../../store/createAppSlice';
import { me } from '../../networks/authcalls/me';
import { verifyEmail } from '../../networks/authcalls/verifyEmail';
import { getAccessToken } from '../../utils/storage_utils/storageUtils';
import { toRejectedValue } from '../../networks/network/network';
import { setSession } from '../../store/authSlice';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';

export interface VerifyLinkArgs {
  token?: string;
  /** The web page already verified the address. */
  verified?: boolean;
}

export interface VerifySuccessSliceState {
  status: FormStatus;
  signedIn: boolean;
  error: ServerError;
}

const initialState: VerifySuccessSliceState = { status: 'idle', signedIn: false, error: NO_ERROR };

/** Signed in: the fresh account, or null when it can't be read. */
const reReadSession = async () => {
  try {
    return await me();
  } catch {
    return null;
  }
};

export const verifySuccessSlice = createAppSlice({
  name: 'verifySuccess',
  initialState,
  reducers: create => ({
    verifyLinkAsync: create.asyncThunk(
      async ({ token, verified }: VerifyLinkArgs, { dispatch, rejectWithValue }) => {
        const signedIn = !!(await getAccessToken());
        try {
          if (token) await verifyEmail(token);
          else if (!verified) throw new Error('This verification link is incomplete. Request a new one.');
          if (signedIn) {
            const session = await reReadSession();
            if (session) dispatch(setSession(session));
          }
          return signedIn;
        } catch (e) {
          // Before saying it failed: is the address verified anyway?
          if (signedIn) {
            const session = await reReadSession();
            if (session?.user.isEmailVerified) {
              dispatch(setSession(session));
              return true;
            }
          }
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
          state.signedIn = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, 'This link has expired or been replaced. Open the app and tap Resend.');
        },
      },
    ),
  }),
  selectors: {
    selectVerifySuccess: state => state,
  },
});

export const { verifyLinkAsync } = verifySuccessSlice.actions;
export const { selectVerifySuccess } = verifySuccessSlice.selectors;
