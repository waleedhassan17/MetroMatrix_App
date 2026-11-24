// ═══════════════════════════════════════════════════════
// MetroMatrix — User sign-in slice
// ═══════════════════════════════════════════════════════
// Email + password (and Google) on the customer portal. Staff sign in here
// too, as in the FYP: their accounts come back as a TOTP challenge, which
// moves the gate to the authenticator step without opening a session.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { toRejectedValue } from '../../networks/network/network';
import { googleAndOpen, signInAndOpen } from '../shared/authThunks';
import { NO_ERROR, lockedUntilAfter, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import type { Touched } from '../../utils/form-errors/formErrors';

type Field = 'email' | 'password';

export interface SignInSliceState {
  email: string;
  password: string;
  touched: Touched<Field>;
  status: FormStatus;
  googleStatus: FormStatus;
  error: ServerError;
  /** RATE_LIMITED: Sign In waits until then (lockedUntilAfter). */
  lockedUntil: number;
  /** Wrong passwords in a row: from the third, the notice offers "Forgot your password?". */
  wrongPasswords: number;
}

const initialState: SignInSliceState = {
  email: '',
  password: '',
  touched: {},
  status: 'idle',
  googleStatus: 'idle',
  error: NO_ERROR,
  lockedUntil: 0,
  wrongPasswords: 0,
};

/** Google's EMAIL_NOT_VERIFIED means Google hasn't verified the address — not our emailed link. */
const googleError = (error: ServerError): ServerError =>
  error.code === 'EMAIL_NOT_VERIFIED'
    ? { ...error, message: "Google hasn't verified this email address yet. Verify it with Google, or use your email and a password." }
    : error;

export const signInSlice = createAppSlice({
  name: 'signIn',
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
    touchAll: create.reducer(state => {
      state.touched = { email: true, password: true };
    }),
    /** A message from outside the API (Google's SDK); `code` GOOGLE_UNAVAILABLE reads as information. */
    showError: create.reducer((state, action: PayloadAction<string | { message: string; code?: string; details?: unknown }>) => {
      const p = action.payload;
      state.error =
        typeof p === 'string'
          ? { message: p, code: null, details: null }
          : { message: p.message, code: p.code ?? null, details: (p.details as ServerError['details']) ?? null };
      // A staff sign-in locked out for too many codes: Sign In waits it out too.
      state.lockedUntil = lockedUntilAfter(state.error);
    }),

    signInAsync: create.asyncThunk(
      async ({ email, password }: { email: string; password: string }, { dispatch, rejectWithValue }) => {
        try {
          return await signInAndOpen(dispatch, 'customer', email, password);
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
          state.lockedUntil = lockedUntilAfter(state.error);
          // The typed password goes: it was wrong, and it must not wait in the form for the next person.
          state.password = '';
          state.wrongPasswords = state.error.code === 'INVALID_CREDENTIALS' ? state.wrongPasswords + 1 : 0;
        },
      },
    ),

    googleSignInAsync: create.asyncThunk(
      async (idToken: string, { dispatch, rejectWithValue }) => {
        try {
          await googleAndOpen(dispatch, idToken);
          return true;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.googleStatus = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.googleStatus = 'idle';
        },
        rejected: (state, action) => {
          state.googleStatus = 'failed';
          state.error = googleError(readRejection(action, 'Google sign-in failed. Try again.'));
        },
      },
    ),
  }),
  selectors: {
    selectSignIn: state => state,
  },
});

export const { setEmail, setPassword, touch, touchAll, showError, signInAsync, googleSignInAsync } = signInSlice.actions;
export const { selectSignIn } = signInSlice.selectors;
