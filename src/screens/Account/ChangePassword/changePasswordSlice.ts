// ═══════════════════════════════════════════════════════
// MetroMatrix — Change password slice
// ═══════════════════════════════════════════════════════
// Google-only accounts (user.hasPassword === false) set a FIRST password:
// no current password is asked for; Google is asked for a fresh ID token
// instead, which the API checks belongs to this account.
//
// The API signs every device out, this one included, and returns a new pair
// (authChangePassword stores it). The session is then replaced from
// /auth/me as a whole, so the role and business stay the server's.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { authChangePassword } from '@networks/auth/authNetwork';
import { ApiError, toRejectedValue, ERROR_CODES } from '@networks/network/apiHelpers';
import { getGoogleIdToken } from '@/services/googleAuth';
import { setSession } from '../../Auth/authSlice';
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
          let session;
          if (currentPassword) {
            session = await authChangePassword({ currentPassword, newPassword });
          } else {
            const idToken = await getGoogleIdToken();
            if (!idToken) throw new ApiError('Confirm with Google to set your password.', ERROR_CODES.GOOGLE_CANCELLED);
            session = await authChangePassword({ idToken, newPassword });
          }
          dispatch(setSession(session));
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
          // Google-only: a mismatched Google account is INVALID_CREDENTIALS too.
          const googleOnly = !action.meta.arg.currentPassword;
          state.error =
            error.code === ERROR_CODES.INVALID_CREDENTIALS
              ? {
                  ...error,
                  message: googleOnly
                    ? 'That Google account is not the one linked to MetroMatrix.'
                    : 'Your current password is not correct.',
                }
              : error;
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
