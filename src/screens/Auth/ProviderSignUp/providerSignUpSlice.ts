// ═══════════════════════════════════════════════════════
// MetroMatrix — Service Provider sign-up slice
// ═══════════════════════════════════════════════════════
// The FYP's four fields plus the type picked on Provider Selection. The new
// account is unverified → Email Verification → Personal Info.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { toPkPhone } from '@models/authModel';
import type { SubType } from '@/types';
import { signUpAndOpen } from '../shared/authThunks';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import type { Touched } from '@utils/formErrors';
import type { SignUpField } from '@components/auth/AuthFields';

export interface ProviderSignUpSliceState {
  values: Record<SignUpField, string>;
  touched: Touched<SignUpField>;
  status: FormStatus;
  error: ServerError;
}

const initialState: ProviderSignUpSliceState = {
  values: { name: '', phone: '', email: '', password: '' },
  touched: {},
  status: 'idle',
  error: NO_ERROR,
};

export const providerSignUpSlice = createAppSlice({
  name: 'providerSignUp',
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

    signUpAsync: create.asyncThunk(
      async (
        { values, subType }: { values: Record<SignUpField, string>; subType: SubType },
        { dispatch, rejectWithValue },
      ) => {
        try {
          await signUpAndOpen(dispatch, {
            name: values.name,
            email: values.email,
            phone: toPkPhone(values.phone) ?? '',
            password: values.password,
            portal: 'partner',
            subType,
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
  }),
  selectors: {
    selectProviderSignUp: state => state,
  },
});

export const { setField, touch, touchAll, signUpAsync } = providerSignUpSlice.actions;
export const { selectProviderSignUp } = providerSignUpSlice.selectors;
