// ═══════════════════════════════════════════════════════
// MetroMatrix — Authenticator enrolment slice
// ═══════════════════════════════════════════════════════
// First staff sign-in: fetch the secret (QR + text), confirm one code, then
// show the recovery codes ONCE. The session from confirm is held here — not
// in auth — until the admin taps "I've saved them", because opening the
// session swaps the navigator and the codes would be gone unseen.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { adminTotpConfirm, adminTotpEnrol } from '@networks/auth/authNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { Business, TotpEnrolment, User } from '@/types';
import type { PendingTotp } from '../../Auth/authSlice';
import { handleChallengeError } from '../shared/totpChallenge';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../Auth/shared/formStatus';

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
  }),
  selectors: {
    selectAdminTwoFactorEnrol: state => state,
  },
});

export const { setCode, markCodesCopied, resetEnrol, loadEnrolmentAsync, confirmAsync } = adminTwoFactorEnrolSlice.actions;
export const { selectAdminTwoFactorEnrol } = adminTwoFactorEnrolSlice.selectors;
