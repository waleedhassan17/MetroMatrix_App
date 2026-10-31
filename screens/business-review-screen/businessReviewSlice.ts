// ═══════════════════════════════════════════════════════
// MetroMatrix — Business review slice (admin decision)
// ═══════════════════════════════════════════════════════
// Load one application, then approve / reject (reason + per-document notes)
// / suspend (reason) / reinstate (reason). Each decision drops the row from the
// approval queue so the list is right when the admin goes back.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import {
  approveBusiness,
  fetchBusiness,
  reinstateBusiness,
  rejectBusiness,
  suspendBusiness,
} from '../../networks/admin/adminBusiness';
import { toRejectedValue } from '../../networks/network/network';
import { cleanDocumentNotes } from '../../models/businessModel';
import type { Business, BusinessWithOwner } from '../../models';
import { removeFromQueue } from '../approval-queue-screen/approvalQueueSlice';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { businessSerializer, businessWithOwnerSerializer } from '../../serializers/businessSerializer';

export type Decision = 'approve' | 'reject' | 'suspend' | 'reinstate';
/** The decisions that need a reason, each in its own sheet. */
export type ReasonSheet = Exclude<Decision, 'approve'>;

export interface BusinessReviewSliceState {
  business: BusinessWithOwner | null;
  loadStatus: FormStatus;
  sheet: ReasonSheet | null;
  reason: string;
  reasonTouched: boolean;
  documentNotes: Record<string, string>;
  deciding: Decision | null;
  lastDecision: Decision | null;
  viewer: { uri: string; title: string } | null;
  error: ServerError;
}

const initialState: BusinessReviewSliceState = {
  business: null,
  loadStatus: 'idle',
  sheet: null,
  reason: '',
  reasonTouched: false,
  documentNotes: {},
  deciding: null,
  lastDecision: null,
  viewer: null,
  error: NO_ERROR,
};

/** Keep the owner from the detail call; the decision endpoints return a bare business. */
const withOwner = (state: BusinessReviewSliceState, business: Business) => {
  if (state.business) state.business = { ...business, owner: state.business.owner };
};

export const businessReviewSlice = createAppSlice({
  name: 'businessReview',
  initialState,
  reducers: create => ({
    openSheet: create.reducer((state, action: PayloadAction<ReasonSheet | null>) => {
      state.sheet = action.payload;
      state.reason = '';
      state.reasonTouched = false;
      state.documentNotes = {};
      state.error = NO_ERROR;
    }),
    setReason: create.reducer((state, action: PayloadAction<string>) => {
      state.reason = action.payload;
    }),
    touchReason: create.reducer(state => {
      state.reasonTouched = true;
    }),
    setDocumentNote: create.reducer((state, action: PayloadAction<{ id: string; note: string }>) => {
      state.documentNotes[action.payload.id] = action.payload.note;
    }),
    openViewer: create.reducer((state, action: PayloadAction<{ uri: string; title: string } | null>) => {
      state.viewer = action.payload;
    }),
    resetReview: create.reducer(() => initialState),

    loadBusinessAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return await fetchBusiness(id);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.loadStatus = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = businessWithOwnerSerializer(action.payload);
          state.loadStatus = 'succeeded';
          state.business = payload;
        },
        rejected: (state, action) => {
          state.loadStatus = 'failed';
          state.error = readRejection(action, "We couldn't load this application.");
        },
      },
    ),

    decideAsync: create.asyncThunk(
      async (
        args: { id: string; decision: Decision; reason?: string; documentNotes?: Record<string, string> },
        { dispatch, rejectWithValue },
      ) => {
        try {
          const raw =
            args.decision === 'approve'
              ? await approveBusiness(args.id)
              : args.decision === 'reject'
                ? await rejectBusiness(args.id, {
                    reason: (args.reason ?? '').trim(),
                    documentNotes: cleanDocumentNotes(args.documentNotes ?? {}),
                  })
                : args.decision === 'suspend'
                  ? await suspendBusiness(args.id, (args.reason ?? '').trim())
                  : await reinstateBusiness(args.id, (args.reason ?? '').trim());
          dispatch(removeFromQueue(args.id));
          return raw;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.deciding = action.meta.arg.decision;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const business = businessSerializer(action.payload);
          if (business) withOwner(state, business);
          state.lastDecision = action.meta.arg.decision;
          state.deciding = null;
          state.sheet = null;
        },
        rejected: (state, action) => {
          state.deciding = null;
          state.error = readRejection(action, "That decision didn't go through. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectBusinessReview: state => state,
  },
});

export const {
  openSheet,
  setReason,
  touchReason,
  setDocumentNote,
  openViewer,
  resetReview,
  loadBusinessAsync,
  decideAsync,
} = businessReviewSlice.actions;

export const { selectBusinessReview } = businessReviewSlice.selectors;
