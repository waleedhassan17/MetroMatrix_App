// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin TOTP slice (the second step of a staff sign-in)
// ═══════════════════════════════════════════════════════
// Staff sign in on the ordinary Sign In screen, as in the FYP. Their
// password step returns a TOTP challenge and NO tokens; the challenge sits in
// auth.pendingTotp, which moves the gate here (or to enrolment on a first
// sign-in). This step accepts a 6-digit code or a single-use recovery code.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { resetAllState } from '@store/resetAllState';
import { authAdminTotp } from '@networks/auth/authNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { setPendingTotp, setSession } from '../../Auth/authSlice';
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

/** Codes that mean the challenge itself is gone: sign in again. */
export const CHALLENGE_DEAD = ['CHALLENGE_EXPIRED', 'CHALLENGE_INVALID'];

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
      async (args: { challengeToken: string; code?: string; recoveryCode?: string }, { dispatch, rejectWithValue }) => {
        try {
          const factor = args.recoveryCode ? { recoveryCode: args.recoveryCode.trim() } : { code: args.code ?? '' };
          const result = await authAdminTotp(args.challengeToken, factor);
          dispatch(resetAllState());
          dispatch(setSession({ user: result.user, business: result.business }));
          return true;
        } catch (e) {
          const rejected = toRejectedValue(e);
          if (rejected.code && CHALLENGE_DEAD.includes(rejected.code)) dispatch(setPendingTotp(null));
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
          state.error =
            error.code === 'RECOVERY_CODE_USED'
              ? { ...error, message: 'That recovery code has already been used. Each code works once.' }
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
