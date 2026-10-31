// ═══════════════════════════════════════════════════════
// MetroMatrix — Approval queue slice
// ═══════════════════════════════════════════════════════
// Pending businesses, one list per service tab. Each tab loads, refreshes
// and pages on its own, so switching tabs never blanks another tab's list.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../store/createAppSlice';
import { getBusinessesAPI } from '../../../networks/admin/adminBusinessNetwork';
import { toRejectedValue, required } from '../../../networks/network/apiHelpers';
import type { BusinessSummary, ServiceType } from '../../../types';
import { NO_ERROR, readRejection, type ServerError } from '../../Auth/shared/formStatus';

/** Applications per page of the queue. */
const QUEUE_PAGE_SIZE = 20;
import { businessPageSerializer } from '../../../serializers/businessSerializer';

export type QueueTab = 'all' | ServiceType;
export type LoadMode = 'initial' | 'refresh' | 'more';

export interface QueueList {
  items: BusinessSummary[];
  nextCursor: string | null;
  status: 'idle' | 'loading' | 'refreshing' | 'loadingMore' | 'loaded' | 'failed';
  error: ServerError;
}

export interface ApprovalQueueSliceState {
  tab: QueueTab;
  lists: Record<QueueTab, QueueList>;
}

const emptyList = (): QueueList => ({ items: [], nextCursor: null, status: 'idle', error: NO_ERROR });

const initialState: ApprovalQueueSliceState = {
  tab: 'all',
  lists: { all: emptyList(), shopping: emptyList(), healthcare: emptyList(), food: emptyList() },
};

export const approvalQueueSlice = createAppSlice({
  name: 'approvalQueue',
  initialState,
  reducers: create => ({
    setTab: create.reducer((state, action: PayloadAction<QueueTab>) => {
      state.tab = action.payload;
    }),
    /** A decision was made in BusinessReview: drop the row everywhere. */
    removeFromQueue: create.reducer((state, action: PayloadAction<string>) => {
      for (const list of Object.values(state.lists)) {
        list.items = list.items.filter(b => b.id !== action.payload);
      }
    }),

    loadQueueAsync: create.asyncThunk(
      async (
        { tab, mode, cursor }: { tab: QueueTab; mode: LoadMode; cursor?: string | null },
        { rejectWithValue },
      ) => {
        try {
          // The API pages by number; the queue's "load more" cursor is the next page.
          const raw = await getBusinessesAPI({
            status: 'pending_approval',
            serviceType: tab === 'all' ? undefined : tab,
            page: mode === 'more' ? Math.max(1, Number(cursor) || 1) : 1,
            pageSize: QUEUE_PAGE_SIZE,
          });
          return required(businessPageSerializer(raw));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const list = state.lists[action.meta.arg.tab];
          const mode = action.meta.arg.mode;
          list.status = mode === 'refresh' ? 'refreshing' : mode === 'more' ? 'loadingMore' : 'loading';
          list.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const list = state.lists[action.meta.arg.tab];
          list.items =
            action.meta.arg.mode === 'more' ? [...list.items, ...action.payload.items] : action.payload.items;
          list.nextCursor = action.payload.nextCursor;
          list.status = 'loaded';
        },
        rejected: (state, action) => {
          const list = state.lists[action.meta.arg.tab];
          list.status = 'failed';
          list.error = readRejection(action, "We couldn't load the queue.");
        },
      },
    ),
  }),
  selectors: {
    selectApprovalQueue: state => state,
  },
});

export const { setTab, removeFromQueue, loadQueueAsync } = approvalQueueSlice.actions;
export const { selectApprovalQueue } = approvalQueueSlice.selectors;
