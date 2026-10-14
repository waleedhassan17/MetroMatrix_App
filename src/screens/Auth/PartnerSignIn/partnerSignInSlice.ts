// ═══════════════════════════════════════════════════════
// MetroMatrix — Partner sign-in slice
// ═══════════════════════════════════════════════════════
// The customer sign-in flow on the partner portal, without Google (partners
// verify identity with documents, so the account starts from an email).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { resetAllState } from '@store/resetAllState';
import { authSignin } from '@networks/auth/authNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { setSession } from '../authSlice';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import type { Touched } from '@utils/formErrors';

type Field = 'email' | 'password';

export interface PartnerSignInSliceState {
  email: string;
  password: string;
  touched: Touched<Field>;
  status: FormStatus;
  error: ServerError;
}

const initialState: PartnerSignInSliceState = {
  email: '',
  password: '',
  touched: {},
  status: 'idle',
  error: NO_ERROR,
};

export const partnerSignInSlice = createAppSlice({
  name: 'partnerSignIn',
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
    resetForm: create.reducer(() => initialState),

    submitSignInAsync: create.asyncThunk(
      async ({ email, password }: { email: string; password: string }, { dispatch, rejectWithValue }) => {
        try {
          const outcome = await authSignin({ email, password, portal: 'partner' });
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
  }),

  selectors: {
    selectPartnerSignIn: state => state,
  },
});

export const { setEmail, setPassword, touch, resetForm, submitSignInAsync } = partnerSignInSlice.actions;
export const { selectPartnerSignIn } = partnerSignInSlice.selectors;
