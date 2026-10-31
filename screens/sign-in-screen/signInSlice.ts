// ═══════════════════════════════════════════════════════
// MetroMatrix — User sign-in slice
// ═══════════════════════════════════════════════════════
// Email + password (and Google) on the customer portal. Staff sign in here
// too, as in the FYP: their accounts come back as a TOTP challenge, which
// moves the gate to the authenticator step without opening a session.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { toRejectedValue } from '../../networks/network/apiHelpers';
import { googleAndOpen, signInAndOpen } from '../shared/authThunks';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import type { Touched } from '../../utils/form-errors/formErrors';

type Field = 'email' | 'password';

export interface SignInSliceState {
  email: string;
  password: string;
  touched: Touched<Field>;
  status: FormStatus;
  googleStatus: FormStatus;
  error: ServerError;
}

const initialState: SignInSliceState = {
  email: '',
  password: '',
  touched: {},
  status: 'idle',
  googleStatus: 'idle',
  error: NO_ERROR,
};

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
    showError: create.reducer((state, action: PayloadAction<string>) => {
      state.error = { message: action.payload, code: null, details: null };
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
          state.error = readRejection(action, 'Google sign-in failed. Try again.');
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
