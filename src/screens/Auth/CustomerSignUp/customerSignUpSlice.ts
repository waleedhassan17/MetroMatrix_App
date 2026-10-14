// ═══════════════════════════════════════════════════════
// MetroMatrix — Customer sign-up slice
// ═══════════════════════════════════════════════════════
// Creates a customer account (or continues with Google). The new account is
// unverified, so the gate routes straight to EmailVerification.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { resetAllState } from '@store/resetAllState';
import { authGoogle, authSignup } from '@networks/auth/authNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { toPkPhone } from '@models/authModel';
import { setSession } from '../authSlice';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import type { Touched } from '@utils/formErrors';
import type { SignUpField } from '@components/auth/AuthForms';

export interface CustomerSignUpSliceState {
  values: Record<SignUpField, string>;
  acceptedTerms: boolean;
  touched: Touched<SignUpField | 'acceptedTerms'>;
  status: FormStatus;
  googleStatus: FormStatus;
  error: ServerError;
}

const initialState: CustomerSignUpSliceState = {
  values: { name: '', email: '', phone: '', password: '', confirmPassword: '' },
  acceptedTerms: false,
  touched: {},
  status: 'idle',
  googleStatus: 'idle',
  error: NO_ERROR,
};

export const customerSignUpSlice = createAppSlice({
  name: 'customerSignUp',
  initialState,
  reducers: create => ({
    setField: create.reducer((state, action: PayloadAction<{ field: SignUpField; value: string }>) => {
      state.values[action.payload.field] = action.payload.value;
      state.error = NO_ERROR;
    }),
    setAcceptedTerms: create.reducer((state, action: PayloadAction<boolean>) => {
      state.acceptedTerms = action.payload;
      state.touched.acceptedTerms = true;
    }),
    touch: create.reducer((state, action: PayloadAction<SignUpField>) => {
      state.touched[action.payload] = true;
    }),
    showError: create.reducer((state, action: PayloadAction<string>) => {
      state.error = { message: action.payload, code: null, details: null };
    }),
    resetForm: create.reducer(() => initialState),

    signUpAsync: create.asyncThunk(
      async (
        values: { name: string; email: string; phone: string; password: string },
        { dispatch, rejectWithValue },
      ) => {
        try {
          const result = await authSignup({
            name: values.name,
            email: values.email,
            phone: toPkPhone(values.phone),
            password: values.password,
            portal: 'customer',
          });
          dispatch(resetAllState());
          dispatch(setSession({ user: result.user, business: result.business }));
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
          state.error = readRejection(action, 'We could not create your account. Try again.');
        },
      },
    ),

    googleSignUpAsync: create.asyncThunk(
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
    selectCustomerSignUp: state => state,
  },
});

export const { setField, setAcceptedTerms, touch, showError, resetForm, signUpAsync, googleSignUpAsync } =
  customerSignUpSlice.actions;

export const { selectCustomerSignUp } = customerSignUpSlice.selectors;
