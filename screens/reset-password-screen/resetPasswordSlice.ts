// ═══════════════════════════════════════════════════════
// MetroMatrix — Reset Password slice (step 3)
// ═══════════════════════════════════════════════════════
// POST /auth/reset-password with the step-2 token. The API answers:
//   OTP_INVALID        the token is spent or expired (15 min): it cannot be
//                      retried — the screen sends the user back for a new code
//   VALIDATION_FAILED  the new password breaks the policy: fix and retry
// A reset signs the account out everywhere, so any tokens this device still
// holds are dead: they are cleared here, and the user signs in again.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { resetPassword } from '../../networks/authcalls/forgotPassword';
import { ERROR_CODES, errorCopy, toRejectedValue } from '../../networks/network/network';
import { clearTokens } from '../../utils/storage_utils/storageUtils';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import type { Touched } from '../../utils/form-errors/formErrors';

type Field = 'password' | 'confirmPassword';

export interface ResetPasswordSliceState {
  password: string;
  confirmPassword: string;
  touched: Touched<Field>;
  status: FormStatus;
  error: ServerError;
  /** A reset got no answer: it may have gone through, so a refused retry says so instead of "expired". */
  mayHaveChanged: boolean;
}

const initialState: ResetPasswordSliceState = {
  password: '',
  confirmPassword: '',
  touched: {},
  status: 'idle',
  error: NO_ERROR,
  mayHaveChanged: false,
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
          await resetPassword(resetToken, password);
          await clearTokens();
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
          const error = readRejection(action, "We couldn't reset your password. Try again.");
          if (error.code === ERROR_CODES.NETWORK_ERROR) state.mayHaveChanged = true;
          state.error = { ...error, message: errorCopy(error.code, error.details) ?? error.message };
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
