// ═══════════════════════════════════════════════════════
// MetroMatrix — Service Provider sign-in slice
// ═══════════════════════════════════════════════════════
// The partner portal. No social sign-in for providers (as in the FYP):
// their identity is verified with documents, so the account starts from an
// email and password.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../store/createAppSlice';
import { toRejectedValue } from '../../../networks/network/apiHelpers';
import { signInAndOpen } from '../shared/authThunks';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import type { Touched } from '../../../utils/formErrors';

type Field = 'email' | 'password';

export interface ProviderSignInSliceState {
  email: string;
  password: string;
  touched: Touched<Field>;
  status: FormStatus;
  error: ServerError;
}

const initialState: ProviderSignInSliceState = { email: '', password: '', touched: {}, status: 'idle', error: NO_ERROR };

export const providerSignInSlice = createAppSlice({
  name: 'providerSignIn',
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

    signInAsync: create.asyncThunk(
      async ({ email, password }: { email: string; password: string }, { dispatch, rejectWithValue }) => {
        try {
          return await signInAndOpen(dispatch, 'partner', email, password);
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
  }),
  selectors: {
    selectProviderSignIn: state => state,
  },
});

export const { setEmail, setPassword, touch, touchAll, signInAsync } = providerSignInSlice.actions;
export const { selectProviderSignIn } = providerSignInSlice.selectors;
