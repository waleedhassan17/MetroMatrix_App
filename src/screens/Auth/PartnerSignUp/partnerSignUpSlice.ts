// ═══════════════════════════════════════════════════════
// MetroMatrix — Partner sign-up slice
// ═══════════════════════════════════════════════════════
// Phone is required and the Partner Agreement must be accepted. The new
// account is unverified → EmailVerification → ServiceSelect.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { resetAllState } from '@store/resetAllState';
import { authSignup } from '@networks/auth/authNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { toPkPhone } from '@models/authModel';
import { setSession } from '../authSlice';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import type { Touched } from '@utils/formErrors';
import type { SignUpField } from '@components/auth/AuthForms';

export interface PartnerSignUpSliceState {
  values: Record<SignUpField, string>;
  acceptedTerms: boolean;
  acceptedPartnerTerms: boolean;
  touched: Touched<SignUpField | 'acceptedTerms' | 'acceptedPartnerTerms'>;
  status: FormStatus;
  error: ServerError;
}

const initialState: PartnerSignUpSliceState = {
  values: { name: '', email: '', phone: '', password: '', confirmPassword: '' },
  acceptedTerms: false,
  acceptedPartnerTerms: false,
  touched: {},
  status: 'idle',
  error: NO_ERROR,
};

export const partnerSignUpSlice = createAppSlice({
  name: 'partnerSignUp',
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
    setAcceptedPartnerTerms: create.reducer((state, action: PayloadAction<boolean>) => {
      state.acceptedPartnerTerms = action.payload;
      state.touched.acceptedPartnerTerms = true;
    }),
    touch: create.reducer((state, action: PayloadAction<SignUpField>) => {
      state.touched[action.payload] = true;
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
            phone: toPkPhone(values.phone) ?? '',
            password: values.password,
            portal: 'partner',
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
  }),

  selectors: {
    selectPartnerSignUp: state => state,
  },
});

export const { setField, setAcceptedTerms, setAcceptedPartnerTerms, touch, resetForm, signUpAsync } =
  partnerSignUpSlice.actions;
export const { selectPartnerSignUp } = partnerSignUpSlice.selectors;
