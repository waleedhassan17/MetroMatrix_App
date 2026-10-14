// ═══════════════════════════════════════════════════════
// MetroMatrix — Pending approval slice
// ═══════════════════════════════════════════════════════
// Polls GET /businesses/me/status. When the status has moved on (approved,
// rejected, suspended) it re-reads /auth/me — the fresh session makes the
// gate mount the partner app or the matching gate (QA 21: within 30 s).

import { createAppSlice } from '@store/createAppSlice';
import { authMe } from '@networks/auth/authNetwork';
import { getMyBusinessStatus } from '@networks/businesses/businessNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { setSession } from '../../Auth/authSlice';
import { NO_ERROR, readRejection, type ServerError } from '../../Auth/shared/formStatus';

export interface PendingApprovalSliceState {
  checking: boolean;
  /** Pull-to-refresh, as opposed to the silent 30 s poll. */
  refreshing: boolean;
  lastCheckedAt: number;
  error: ServerError;
}

const initialState: PendingApprovalSliceState = {
  checking: false,
  refreshing: false,
  lastCheckedAt: 0,
  error: NO_ERROR,
};

export const pendingApprovalSlice = createAppSlice({
  name: 'pendingApproval',
  initialState,
  reducers: create => ({
    checkStatusAsync: create.asyncThunk(
      async (_: { manual: boolean }, { dispatch, rejectWithValue }) => {
        try {
          const info = await getMyBusinessStatus();
          if (info.status !== 'pending_approval') {
            dispatch(setSession(await authMe()));
          }
          return info.status;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.checking = true;
          state.refreshing = action.meta.arg.manual;
        },
        fulfilled: state => {
          state.checking = false;
          state.refreshing = false;
          state.lastCheckedAt = Date.now();
          state.error = NO_ERROR;
        },
        rejected: (state, action) => {
          state.checking = false;
          state.refreshing = false;
          // A failed silent poll is retried in 30 s; only say so when asked.
          if (action.meta.arg.manual) state.error = readRejection(action, "We couldn't check your status.");
        },
      },
    ),
  }),
  selectors: {
    selectPendingApproval: state => state,
  },
});

export const { checkStatusAsync } = pendingApprovalSlice.actions;
export const { selectPendingApproval } = pendingApprovalSlice.selectors;
