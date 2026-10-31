// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin TOTP slice (the second step of a staff sign-in)
// ═══════════════════════════════════════════════════════
// Staff sign in on the ordinary Sign In screen, as in the FYP. Their
// password step returns a TOTP challenge and NO tokens; the challenge sits in
// auth.pendingTotp, which moves the gate here (or to enrolment on a first
// sign-in). This step accepts a 6-digit code or a single-use recovery code.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../store/createAppSlice';
import { resetAllState } from '../../../store/resetAllState';
import { authAdminTotp } from '../../../networks/auth/authNetwork';
import { toRejectedValue, ERROR_CODES } from '../../../networks/network/apiHelpers';
import { setSession, type PendingTotp } from '../../Auth/authSlice';
import { handleChallengeError } from '../shared/totpChallenge';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../Auth/shared/formStatus';

export interface AdminTotpSliceState {
  code: string;
  recoveryCode: string;
  useRecovery: boolean;
  status: FormStatus;
  error: ServerError;
}

const initialState: AdminTotpSliceState = {
  code: '',
  recoveryCode: '',
  useRecovery: false,
  status: 'idle',
  error: NO_ERROR,
};

export const adminTotpSlice = createAppSlice({
  name: 'adminTotp',
  initialState,
  reducers: create => ({
    setCode: create.reducer((state, action: PayloadAction<string>) => {
      state.code = action.payload;
      state.error = NO_ERROR;
    }),
    setRecoveryCode: create.reducer((state, action: PayloadAction<string>) => {
      state.recoveryCode = action.payload;
      state.error = NO_ERROR;
    }),
    toggleRecovery: create.reducer(state => {
      state.useRecovery = !state.useRecovery;
      state.code = '';
      state.recoveryCode = '';
      state.error = NO_ERROR;
    }),
    resetTotp: create.reducer(() => initialState),

    verifyTotpAsync: create.asyncThunk(
      async (
        args: { challengeToken: string; code?: string; recoveryCode?: string },
        { dispatch, getState, rejectWithValue },
      ) => {
        try {
          const factor = args.recoveryCode ? { recoveryCode: args.recoveryCode.trim() } : { code: args.code ?? '' };
          const result = await authAdminTotp(args.challengeToken, factor);
          dispatch(resetAllState());
          dispatch(setSession({ user: result.user, business: result.business }));
          return true;
        } catch (e) {
          const rejected = toRejectedValue(e);
          const pending = (getState() as { auth: { pendingTotp: PendingTotp | null } }).auth.pendingTotp;
          handleChallengeError(dispatch, rejected, pending, 'code');
          return rejectWithValue(rejected);
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
          // The API answers TOTP_INVALID for a wrong, reused or spent code alike.
          state.error =
            error.code === ERROR_CODES.TOTP_INVALID
              ? {
                  ...error,
                  message: action.meta.arg.recoveryCode
                    ? "That recovery code isn't valid or has already been used. Each code works once."
                    : "That code didn't work. Wait for the next code in your authenticator and try again.",
                }
              : error;
          state.code = '';
        },
      },
    ),
  }),
  selectors: {
    selectAdminTotp: state => state,
  },
});

export const { setCode, setRecoveryCode, toggleRecovery, resetTotp, verifyTotpAsync } = adminTotpSlice.actions;
export const { selectAdminTotp } = adminTotpSlice.selectors;
