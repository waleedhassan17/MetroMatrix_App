// ═══════════════════════════════════════════════════════
// MetroMatrix — Provider Approval Pending slice
// ═══════════════════════════════════════════════════════
// Polls GET /businesses/me/status every 10 s while the screen is open (the
// FYP's auto-check, with its "Checks Made" and "Next Check" stats), again
// whenever the app returns to the foreground, plus a manual Check Now. When
// the status moves on it re-reads /auth/me — the fresh session makes the gate
// open the partner app, Rejected or Suspended.
//
// One check at a time (a slow link must not stack them up): the next poll is
// scheduled only after the last one answered, and Check Now during a quiet
// check makes that check report to the person instead of starting another.

import { createAppSlice } from '../../store/createAppSlice';
import { me } from '../../networks/authcalls/me';
import { fetchMyBusinessStatus } from '../../networks/businesses/business';
import { errorCopy, toRejectedValue, required } from '../../networks/network/network';
import { setSession } from '../../store/authSlice';
import { NO_ERROR, readRejection, type ServerError } from '../shared/formStatus';
import { stillSignedIn } from '../shared/sessionGuard';
import { businessStatusSerializer } from '../../serializers/businessSerializer';

export const POLL_INTERVAL_MS = 10_000;

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
    /** Check Now while a quiet check is on the wire: that one reports. */
    markManualCheck: create.reducer(state => {
      state.manual = true;
      state.error = NO_ERROR;
    }),

    checkStatusAsync: create.asyncThunk(
      async (_: { manual: boolean }, { dispatch, rejectWithValue }) => {
        try {
          const status = await fetchMyBusinessStatus();
          // A decision opens the app: the status decides whether to read the session again.
          if (required(businessStatusSerializer(status)).status !== 'pending_approval') {
            const session = await me();
            // Signed out while this was on the wire: don't bring the session back.
            if (await stillSignedIn()) dispatch(setSession(session));
          }
          return status;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        options: {
          condition: (_arg, { getState }) =>
            !(getState() as { providerApprovalPending: ProviderApprovalPendingSliceState }).providerApprovalPending.checking,
        },
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
          // Refused because a check is already on the wire: that one reports.
          if (action.meta.condition) return;
          state.checking = false;
          state.nextCheckAt = Date.now() + POLL_INTERVAL_MS;
          // A failed silent poll is simply retried; only say so when asked.
          if (state.manual) {
            const error = readRejection(action, "We couldn't check your status. Try again.");
            state.error = { ...error, message: errorCopy(error.code, error.details) ?? error.message };
          }
          state.manual = false;
        },
      },
    ),
  }),
  selectors: {
    selectProviderApprovalPending: state => state,
  },
});

export const { scheduleNextCheck, markManualCheck, checkStatusAsync } = providerApprovalPendingSlice.actions;
export const { selectProviderApprovalPending } = providerApprovalPendingSlice.selectors;
