// ═══════════════════════════════════════════════════════
// MetroMatrix — Customer sign-in slice
// ═══════════════════════════════════════════════════════
// Email + password and Google, on the customer portal. A successful sign-in
// resets the store (RESET_ALL_STATE — nothing from a previous account
// survives) and opens the session; AppContainer's gate does the routing.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { resetAllState } from '@store/resetAllState';
import { authGoogle, authSignin } from '@networks/auth/authNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { setSession } from '../authSlice';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import type { Touched } from '@utils/formErrors';

type Field = 'email' | 'password';

export interface CustomerSignInSliceState {
  email: string;
  password: string;
  touched: Touched<Field>;
  status: FormStatus;
  googleStatus: FormStatus;
  error: ServerError;
}

const initialState: CustomerSignInSliceState = {
  email: '',
  password: '',
  touched: {},
  status: 'idle',
  googleStatus: 'idle',
  error: NO_ERROR,
};

export const customerSignInSlice = createAppSlice({
  name: 'customerSignIn',
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
    /** A client-side failure (e.g. Google unavailable) shown in the same notice. */
    showError: create.reducer((state, action: PayloadAction<string>) => {
      state.error = { message: action.payload, code: null, details: null };
    }),
    clearError: create.reducer(state => {
      state.error = NO_ERROR;
    }),
    resetForm: create.reducer(() => initialState),

    submitSignInAsync: create.asyncThunk(
      async ({ email, password }: { email: string; password: string }, { dispatch, rejectWithValue }) => {
        try {
          const outcome = await authSignin({ email, password, portal: 'customer' });
          if (outcome.kind === 'totp') {
            return rejectWithValue({
              message: 'This is a staff account. Use staff sign-in.',
              code: 'WRONG_PORTAL',
              details: { portal: 'admin' },
            });
          }
          dispatch(resetAllState());
          dispatch(setSession({ user: outcome.result.user, business: outcome.result.business }));
          return true;
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
          state.status = 'succeeded';
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
          const result = await authGoogle(idToken);
          dispatch(resetAllState());
          dispatch(setSession({ user: result.user, business: result.business }));
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
          state.googleStatus = 'succeeded';
        },
        rejected: (state, action) => {
          state.googleStatus = 'failed';
          state.error = readRejection(action, 'Google sign-in failed. Try again.');
        },
      },
    ),
  }),

  selectors: {
    selectCustomerSignIn: state => state,
  },
});

export const {
  setEmail,
  setPassword,
  touch,
  showError,
  clearError,
  resetForm,
  submitSignInAsync,
  googleSignInAsync,
} = customerSignInSlice.actions;

export const { selectCustomerSignIn } = customerSignInSlice.selectors;
