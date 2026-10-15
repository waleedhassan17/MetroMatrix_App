// ═══════════════════════════════════════════════════════
// MetroMatrix — Reset Password slice (step 3)
// ═══════════════════════════════════════════════════════
// POST /auth/reset-password with the step-2 token. A spent or expired token
// (RESET_TOKEN_INVALID) cannot be retried — the screen sends the user back
// for a new code.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { authResetPassword } from '@networks/auth/authNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import type { Touched } from '@utils/formErrors';

type Field = 'password' | 'confirmPassword';

export interface ResetPasswordSliceState {
  password: string;
  confirmPassword: string;
  touched: Touched<Field>;
  status: FormStatus;
  error: ServerError;
}

const initialState: ResetPasswordSliceState = {
  password: '',
  confirmPassword: '',
  touched: {},
  status: 'idle',
  error: NO_ERROR,
};

export const resetPasswordSlice = createAppSlice({
  name: 'resetPassword',
  initialState,
  reducers: create => ({
    setField: create.reducer((state, action: PayloadAction<{ field: Field; value: string }>) => {
      state[action.payload.field] = action.payload.value;
      state.error = NO_ERROR;
    }),
    touch: create.reducer((state, action: PayloadAction<Field>) => {
      state.touched[action.payload] = true;
    }),
    touchAll: create.reducer(state => {
      state.touched = { password: true, confirmPassword: true };
    }),
    resetResetPassword: create.reducer(() => initialState),

    resetPasswordAsync: create.asyncThunk(
      async ({ resetToken, password }: { resetToken: string; password: string }, { rejectWithValue }) => {
        try {
          await authResetPassword(resetToken, password);
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
        fulfilled: () => ({ ...initialState, status: 'succeeded' as const }),
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't reset your password. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectResetPassword: state => state,
  },
});

export const { setField, touch, touchAll, resetResetPassword, resetPasswordAsync } = resetPasswordSlice.actions;
export const { selectResetPassword } = resetPasswordSlice.selectors;
