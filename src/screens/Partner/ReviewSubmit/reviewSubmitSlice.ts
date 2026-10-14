// ═══════════════════════════════════════════════════════
// MetroMatrix — Review and submit slice
// ═══════════════════════════════════════════════════════
// Submits the draft for approval. The server is the authority on what is
// missing: 422 DOCUMENTS_MISSING carries `details.missing`, which the screen
// passes to Documents to highlight those tiles (QA 17). On success the
// business becomes pending_approval and the gate moves to PendingApproval.

import { createAppSlice } from '@store/createAppSlice';
import { submitBusiness } from '@networks/businesses/businessNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { DocumentKind } from '@/types';
import { setBusiness } from '../../Auth/authSlice';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../Auth/shared/formStatus';

export interface ReviewSubmitSliceState {
  status: FormStatus;
  error: ServerError;
  missing: DocumentKind[];
}

const initialState: ReviewSubmitSliceState = { status: 'idle', error: NO_ERROR, missing: [] };

export const reviewSubmitSlice = createAppSlice({
  name: 'reviewSubmit',
  initialState,
  reducers: create => ({
    clearSubmitError: create.reducer(state => {
      state.error = NO_ERROR;
      state.missing = [];
    }),

    submitAsync: create.asyncThunk(
      async (_: void, { dispatch, rejectWithValue }) => {
        try {
          dispatch(setBusiness(await submitBusiness()));
          return true;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = NO_ERROR;
          state.missing = [];
        },
        fulfilled: state => {
          state.status = 'succeeded';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't submit your application. Try again.");
          const missing = state.error.details?.missing;
          state.missing = Array.isArray(missing) ? (missing as DocumentKind[]) : [];
        },
      },
    ),
  }),
  selectors: {
    selectReviewSubmit: state => state,
  },
});

export const { clearSubmitError, submitAsync } = reviewSubmitSlice.actions;
export const { selectReviewSubmit } = reviewSubmitSlice.selectors;
