// ═══════════════════════════════════════════════════════
// MetroMatrix — Verify Success slice (the email link's landing)
// ═══════════════════════════════════════════════════════
// metromatrix://verify-success?token=… opens here. The token verifies the
// email; if a session is already open, /auth/me moves the gate on, otherwise
// the screen offers Sign In.

import { createAppSlice } from '@store/createAppSlice';
import { authMe, authVerifyEmail } from '@networks/auth/authNetwork';
import { getAccessToken } from '@utils/storageUtils';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { setSession } from '../authSlice';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';

export interface VerifySuccessSliceState {
  status: FormStatus;
  signedIn: boolean;
  error: ServerError;
}

const initialState: VerifySuccessSliceState = { status: 'idle', signedIn: false, error: NO_ERROR };

export const verifySuccessSlice = createAppSlice({
  name: 'verifySuccess',
  initialState,
  reducers: create => ({
    verifyLinkAsync: create.asyncThunk(
      async (token: string, { dispatch, rejectWithValue }) => {
        try {
          await authVerifyEmail(token);
          if (await getAccessToken()) {
            dispatch(setSession(await authMe()));
            return true;
          }
          return false;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.signedIn = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, 'This verification link is invalid or has expired.');
        },
      },
    ),
  }),
  selectors: {
    selectVerifySuccess: state => state,
  },
});

export const { verifyLinkAsync } = verifySuccessSlice.actions;
export const { selectVerifySuccess } = verifySuccessSlice.selectors;
