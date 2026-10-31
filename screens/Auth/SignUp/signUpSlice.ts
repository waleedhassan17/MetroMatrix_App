// ═══════════════════════════════════════════════════════
// MetroMatrix — User sign-up slice
// ═══════════════════════════════════════════════════════
// The FYP's four fields (name, phone, email, password), or Google. The new
// account is unverified, so the gate opens Email Verification next.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../store/createAppSlice';
import { toRejectedValue } from '../../../networks/network/apiHelpers';
import { toPkPhone } from '../../../models/authModel';
import { googleAndOpen, signUpAndOpen } from '../shared/authThunks';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import type { Touched } from '../../../utils/formErrors';
import type { SignUpField } from '../../../Components/auth/AuthFields';

export interface SignUpSliceState {
  values: Record<SignUpField, string>;
  touched: Touched<SignUpField>;
  status: FormStatus;
  googleStatus: FormStatus;
  error: ServerError;
}

const initialState: SignUpSliceState = {
  values: { name: '', phone: '', email: '', password: '' },
  touched: {},
  status: 'idle',
  googleStatus: 'idle',
  error: NO_ERROR,
};

export const signUpSlice = createAppSlice({
  name: 'signUp',
  initialState,
  reducers: create => ({
    setField: create.reducer((state, action: PayloadAction<{ field: SignUpField; value: string }>) => {
      state.values[action.payload.field] = action.payload.value;
      state.error = NO_ERROR;
    }),
    touch: create.reducer((state, action: PayloadAction<SignUpField>) => {
      state.touched[action.payload] = true;
    }),
    touchAll: create.reducer(state => {
      state.touched = { name: true, phone: true, email: true, password: true };
    }),
    showError: create.reducer((state, action: PayloadAction<string>) => {
      state.error = { message: action.payload, code: null, details: null };
    }),

    signUpAsync: create.asyncThunk(
      async (values: Record<SignUpField, string>, { dispatch, rejectWithValue }) => {
        try {
          await signUpAndOpen(dispatch, {
            name: values.name,
            email: values.email,
            phone: toPkPhone(values.phone) ?? '',
            password: values.password,
            portal: 'customer',
          });
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
          state.status = 'idle';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, 'We could not create your account. Try again.');
        },
      },
    ),

    googleSignUpAsync: create.asyncThunk(
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
    selectSignUp: state => state,
  },
});

export const { setField, touch, touchAll, showError, signUpAsync, googleSignUpAsync } = signUpSlice.actions;
export const { selectSignUp } = signUpSlice.selectors;
