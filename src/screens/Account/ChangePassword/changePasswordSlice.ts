// ═══════════════════════════════════════════════════════
// MetroMatrix — Change password slice
// ═══════════════════════════════════════════════════════
// Google-only accounts (user.hasPassword === false) set a FIRST password:
// no current password is asked for or sent.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { authChangePassword } from '@networks/auth/authNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { setUser } from '../../Auth/authSlice';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../Auth/shared/formStatus';
import type { Touched } from '@utils/formErrors';

export type ChangePasswordField = 'currentPassword' | 'password' | 'confirmPassword';

export interface ChangePasswordSliceState {
  values: Record<ChangePasswordField, string>;
  touched: Touched<ChangePasswordField>;
  status: FormStatus;
  error: ServerError;
}

const initialState: ChangePasswordSliceState = {
  values: { currentPassword: '', password: '', confirmPassword: '' },
  touched: {},
  status: 'idle',
  error: NO_ERROR,
};

export const changePasswordSlice = createAppSlice({
  name: 'changePassword',
  initialState,
  reducers: create => ({
    setField: create.reducer((state, action: PayloadAction<{ field: ChangePasswordField; value: string }>) => {
      state.values[action.payload.field] = action.payload.value;
      state.error = NO_ERROR;
    }),
    touch: create.reducer((state, action: PayloadAction<ChangePasswordField>) => {
      state.touched[action.payload] = true;
    }),
    resetChangePassword: create.reducer(() => initialState),

    changePasswordAsync: create.asyncThunk(
      async (
        { currentPassword, newPassword }: { currentPassword?: string; newPassword: string },
        { dispatch, rejectWithValue },
      ) => {
        try {
          const user = await authChangePassword(currentPassword ? { currentPassword, newPassword } : { newPassword });
          dispatch(setUser(user));
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
          const error = readRejection(action, "We couldn't change your password. Try again.");
          state.error =
            error.code === 'INVALID_CREDENTIALS' ? { ...error, message: 'Your current password is not correct.' } : error;
        },
      },
    ),
  }),

  selectors: {
    selectChangePassword: state => state,
  },
});

export const { setField, touch, resetChangePassword, changePasswordAsync } = changePasswordSlice.actions;
export const { selectChangePassword } = changePasswordSlice.selectors;
