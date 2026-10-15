// ═══════════════════════════════════════════════════════
// MetroMatrix — Provider Approval Pending slice
// ═══════════════════════════════════════════════════════
// Polls GET /businesses/me/status every 30 s while the screen is open (the
// FYP's auto-check, with its "Checks Made" and "Next Check" stats), plus a
// manual Check Now. When the status moves on it re-reads /auth/me — the fresh
// session makes the gate open the partner app, Rejected or Suspended.

import { createAppSlice } from '@store/createAppSlice';
import { authMe } from '@networks/auth/authNetwork';
import { getMyBusinessStatus } from '@networks/businesses/businessNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { setSession } from '../../Auth/authSlice';
import { NO_ERROR, readRejection, type ServerError } from '../../Auth/shared/formStatus';

export const POLL_INTERVAL_MS = 30_000;

export interface ProviderApprovalPendingSliceState {
  checking: boolean;
  /** A Check Now press, as opposed to the silent poll. */
  manual: boolean;
  checks: number;
  nextCheckAt: number;
  error: ServerError;
}

const initialState: ProviderApprovalPendingSliceState = {
  checking: false,
  manual: false,
  checks: 0,
  nextCheckAt: 0,
  error: NO_ERROR,
};

export const providerApprovalPendingSlice = createAppSlice({
  name: 'providerApprovalPending',
  initialState,
  reducers: create => ({
    scheduleNextCheck: create.reducer(state => {
      state.nextCheckAt = Date.now() + POLL_INTERVAL_MS;
    }),

    checkStatusAsync: create.asyncThunk(
      async (_: { manual: boolean }, { dispatch, rejectWithValue }) => {
        try {
          const info = await getMyBusinessStatus();
          if (info.status !== 'pending_approval') dispatch(setSession(await authMe()));
          return info.status;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.checking = true;
          state.manual = action.meta.arg.manual;
          if (action.meta.arg.manual) state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.checking = false;
          state.manual = false;
          state.checks += 1;
          state.nextCheckAt = Date.now() + POLL_INTERVAL_MS;
          state.error = NO_ERROR;
        },
        rejected: (state, action) => {
          state.checking = false;
          state.nextCheckAt = Date.now() + POLL_INTERVAL_MS;
          // A failed silent poll is simply retried; only say so when asked.
          if (state.manual) state.error = readRejection(action, "We couldn't check your status. Try again.");
          state.manual = false;
        },
      },
    ),
  }),
  selectors: {
    selectProviderApprovalPending: state => state,
  },
});

export const { scheduleNextCheck, checkStatusAsync } = providerApprovalPendingSlice.actions;
export const { selectProviderApprovalPending } = providerApprovalPendingSlice.selectors;
