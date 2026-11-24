// ═══════════════════════════════════════════════════════
// MetroMatrix — Authenticator enrolment slice
// ═══════════════════════════════════════════════════════
// First staff sign-in: fetch the secret (QR + text), confirm one code, then
// show the recovery codes ONCE. The session from confirm is held here — not
// in auth — until the admin taps "I've saved them", because opening the
// session swaps the navigator and the codes would be gone unseen.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { adminTotpConfirm, adminTotpEnrol } from '../../networks/authcalls/adminTotp';
import { openSession } from '../../networks/authcalls/session';
import { resetAllState } from '../../store/resetAllState';
import { setSession } from '../../store/authSlice';
import type { AuthResult } from '../../models/auth';

/**
 * The confirmed session, held in memory (never Redux, never disk) until the
 * recovery codes are saved: closing the app on the codes step then means
 * signing in again and seeing new codes, never a console without them.
 */
let heldSession: AuthResult | null = null;
import { toRejectedValue } from '../../networks/network/network';
import type { Business, TotpEnrolment, User } from '../../models';
import type { PendingTotp } from '../../store/authSlice';
import { handleChallengeError } from '../shared/totpChallenge';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';

export interface AdminTwoFactorEnrolSliceState {
  enrolment: TotpEnrolment | null;
  loadStatus: FormStatus;
  code: string;
  confirmStatus: FormStatus;
  recoveryCodes: string[];
  session: { user: User; business: Business | null } | null;
  codesCopied: boolean;
  error: ServerError;
}

const initialState: AdminTwoFactorEnrolSliceState = {
  enrolment: null,
  loadStatus: 'idle',
  code: '',
  confirmStatus: 'idle',
  recoveryCodes: [],
  session: null,
  codesCopied: false,
  error: NO_ERROR,
};

const pendingOf = (getState: () => unknown) =>
  (getState() as { auth: { pendingTotp: PendingTotp | null } }).auth.pendingTotp;

export const adminTwoFactorEnrolSlice = createAppSlice({
  name: 'adminTwoFactorEnrol',
  initialState,
  reducers: create => ({
    setCode: create.reducer((state, action: PayloadAction<string>) => {
      state.code = action.payload;
      state.error = NO_ERROR;
    }),
    markCodesCopied: create.reducer(state => {
      state.codesCopied = true;
    }),
    resetEnrol: create.reducer(() => initialState),

    loadEnrolmentAsync: create.asyncThunk(
      async (challengeToken: string, { dispatch, getState, rejectWithValue }) => {
        try {
          return await adminTotpEnrol(challengeToken);
        } catch (e) {
          const rejected = toRejectedValue(e);
          handleChallengeError(dispatch, rejected, pendingOf(getState), 'enrol');
          return rejectWithValue(rejected);
        }
      },
      {
        pending: state => {
          state.loadStatus = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.loadStatus = 'succeeded';
          state.enrolment = action.payload;
        },
        rejected: (state, action) => {
          state.loadStatus = 'failed';
          state.error = readRejection(action, "We couldn't start authenticator setup.");
        },
      },
    ),

    confirmAsync: create.asyncThunk(
      async ({ challengeToken, code }: { challengeToken: string; code: string }, { dispatch, getState, rejectWithValue }) => {
        try {
          const { result, recoveryCodes } = await adminTotpConfirm(challengeToken, code);
          heldSession = result;
          return { session: { user: result.user, business: result.business }, recoveryCodes };
        } catch (e) {
          const rejected = toRejectedValue(e);
          handleChallengeError(dispatch, rejected, pendingOf(getState), 'enrol');
          return rejectWithValue(rejected);
        }
      },
      {
        pending: state => {
          state.confirmStatus = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.confirmStatus = 'succeeded';
          state.session = action.payload.session;
          state.recoveryCodes = action.payload.recoveryCodes;
          state.code = '';
        },
        rejected: (state, action) => {
          state.confirmStatus = 'failed';
          state.error = readRejection(action, "That code didn't match. Check your phone's time and try again.");
          state.code = '';
        },
      },
    ),

    /** "I've saved them": the held session is stored and opened (the gate moves to the console). */
    finishEnrolAsync: create.asyncThunk(
      async (_: void, { dispatch, rejectWithValue }) => {
        try {
          const result = await openSession(heldSession);
          heldSession = null;
          dispatch(resetAllState());
          dispatch(setSession({ user: result.user, business: result.business }));
          return true;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        rejected: (state, action) => {
          state.error = readRejection(action, 'Sign in again to finish setting up.');
        },
      },
    ),
  }),
  selectors: {
    selectAdminTwoFactorEnrol: state => state,
  },
});

export const { setCode, markCodesCopied, resetEnrol, loadEnrolmentAsync, confirmAsync, finishEnrolAsync } =
  adminTwoFactorEnrolSlice.actions;
export const { selectAdminTwoFactorEnrol } = adminTwoFactorEnrolSlice.selectors;
