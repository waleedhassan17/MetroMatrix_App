// ═══════════════════════════════════════════════════════
// MetroMatrix — Staff sign-in slice (password, then TOTP)
// ═══════════════════════════════════════════════════════
// Step 1 returns a TOTP challenge and NO tokens (QA 20). The challenge goes
// into auth.pendingTotp, which moves the gate to the TOTP branch: AdminTotp
// for an enrolled admin, TotpEnrol on a first sign-in.
// Step 2 accepts a 6-digit code or a single-use recovery code (QA 23).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { resetAllState } from '@store/resetAllState';
import { authAdminTotp, authSignin } from '@networks/auth/authNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { setPendingTotp, setSession } from '../../Auth/authSlice';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../Auth/shared/formStatus';
import type { Touched } from '@utils/formErrors';

type Field = 'email' | 'password';

export interface AdminSignInSliceState {
  email: string;
  password: string;
  touched: Touched<Field>;
  status: FormStatus;
  error: ServerError;
  code: string;
  recoveryCode: string;
  useRecovery: boolean;
  totpStatus: FormStatus;
  totpError: ServerError;
}

const initialState: AdminSignInSliceState = {
  email: '',
  password: '',
  touched: {},
  status: 'idle',
  error: NO_ERROR,
  code: '',
  recoveryCode: '',
  useRecovery: false,
  totpStatus: 'idle',
  totpError: NO_ERROR,
};

/** Codes that mean the challenge itself is gone: start again from step 1. */
const CHALLENGE_DEAD = ['CHALLENGE_EXPIRED', 'CHALLENGE_INVALID'];

export const adminSignInSlice = createAppSlice({
  name: 'adminSignIn',
  initialState,
  reducers: create => ({
    setEmail: create.reducer((state, action: PayloadAction<string>) => {
      state.email = action.payload;
      state.error = NO_ERROR;
    }),
    setPassword: create.reducer((state, action: PayloadAction<string>) => {
      state.password = action.payload;
      state.error = NO_ERROR;
    }),
    touch: create.reducer((state, action: PayloadAction<Field>) => {
      state.touched[action.payload] = true;
    }),
    setCode: create.reducer((state, action: PayloadAction<string>) => {
      state.code = action.payload;
      state.totpError = NO_ERROR;
    }),
    setRecoveryCode: create.reducer((state, action: PayloadAction<string>) => {
      state.recoveryCode = action.payload;
      state.totpError = NO_ERROR;
    }),
    toggleRecovery: create.reducer(state => {
      state.useRecovery = !state.useRecovery;
      state.code = '';
      state.recoveryCode = '';
      state.totpError = NO_ERROR;
    }),
    resetTotp: create.reducer(state => {
      state.code = '';
      state.recoveryCode = '';
      state.useRecovery = false;
      state.totpError = NO_ERROR;
      state.totpStatus = 'idle';
    }),

    signInAsync: create.asyncThunk(
      async ({ email, password }: { email: string; password: string }, { dispatch, rejectWithValue }) => {
        try {
          const outcome = await authSignin({ email, password, portal: 'admin' });
          if (outcome.kind === 'totp') {
            dispatch(
              setPendingTotp({
                challengeToken: outcome.challenge.challengeToken,
                enrolled: outcome.challenge.totpEnrolled,
                email: email.trim().toLowerCase(),
              }),
            );
            return 'totp' as const;
          }
          // A server that skips the second factor (not expected for staff).
          dispatch(resetAllState());
          dispatch(setSession({ user: outcome.result.user, business: outcome.result.business }));
          return 'session' as const;
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
          state.status = 'idle';
          state.password = '';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, 'Sign in failed. Try again.');
        },
      },
    ),

    verifyTotpAsync: create.asyncThunk(
      async (
        args: { challengeToken: string; code?: string; recoveryCode?: string },
        { dispatch, rejectWithValue },
      ) => {
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
          state.totpStatus = 'loading';
          state.totpError = NO_ERROR;
        },
        fulfilled: state => {
          state.totpStatus = 'succeeded';
        },
        rejected: (state, action) => {
          state.totpStatus = 'failed';
          const error = readRejection(action, "That code didn't work. Try again.");
          state.totpError =
            error.code === 'RECOVERY_CODE_USED'
              ? { ...error, message: 'That recovery code has already been used. Each code works once.' }
              : error;
          state.code = '';
          if (CHALLENGE_DEAD.includes(error.code ?? '')) state.error = { ...error, message: 'Your sign-in timed out. Sign in again.' };
        },
      },
    ),
  }),

  selectors: {
    selectAdminSignIn: state => state,
  },
});

export const {
  setEmail,
  setPassword,
  touch,
  setCode,
  setRecoveryCode,
  toggleRecovery,
  resetTotp,
  signInAsync,
  verifyTotpAsync,
} = adminSignInSlice.actions;

export const { selectAdminSignIn } = adminSignInSlice.selectors;
