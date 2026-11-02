// MetroMatrix — Store "Today" slice: the counts to act on, a week of recorded
// sales, the newest orders, and opening the store again after a pause. The
// API's dashboard holds the counts; the name, the pause and the week come
// from the store, its settings and its 7-day insights.

import { createAppSlice } from '../../store/createAppSlice';
import { fetchDashboard, fetchStoreProfile, fetchStoreSettings, resumeStore } from '../../networks/shopping/partner/store';
import { fetchInsights } from '../../networks/shopping/partner/insights';
import { fetchPartnerOrders } from '../../networks/shopping/partner/partnerOrders';
import { toRejectedValue } from '../../networks/network/network';
import type { PartnerOrderRow, PartnerSummary } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { partnerOrderPageSerializer, partnerSummarySerializer, pauseStateSerializer } from '../../serializers/shopping/partnerSerializer';

export interface StoreTodaySliceState {
  summary: PartnerSummary | null;
  recent: PartnerOrderRow[];
  status: FormStatus;
  refreshing: boolean;
  error: ServerError;
  resuming: boolean;
}

const initialState: StoreTodaySliceState = { summary: null, recent: [], status: 'idle', refreshing: false, error: NO_ERROR, resuming: false };

export const storeTodaySlice = createAppSlice({
  name: 'storeToday',
  initialState,
  reducers: create => ({
    loadTodayAsync: create.asyncThunk(
      async (_: { refresh: boolean }, { rejectWithValue }) => {
        try {
          const [dashboard, store, settings, insights, recent] = await Promise.all([
            fetchDashboard(),
            fetchStoreProfile(),
            fetchStoreSettings(),
            fetchInsights('7d'),
            fetchPartnerOrders({ segment: 'new' }, 1, 5),
          ]);
          return { summary: { dashboard, store, settings, insights }, recent };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.status = 'loading';
          state.refreshing = action.meta.arg.refresh;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.refreshing = false;
          state.summary = partnerSummarySerializer(action.payload.summary);
          state.recent = partnerOrderPageSerializer(action.payload.recent).items;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.refreshing = false;
          state.error = readRejection(action, "We couldn't load today's numbers.");
        },
      },
    ),
    resumeStoreAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await resumeStore();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.resuming = true;
        },
        fulfilled: (state, action) => {
          const payload = pauseStateSerializer(action.payload);
          state.resuming = false;
          if (!payload || !state.summary) return;
          state.summary.isPaused = payload.isPaused;
          state.summary.pauseMessage = payload.pauseMessage;
        },
        rejected: (state, action) => {
          state.resuming = false;
          state.error = readRejection(action, "We couldn't open your store again.");
        },
      },
    ),
  }),
  selectors: {
    selectStoreToday: state => state,
    /** New orders waiting (the Orders tab's badge). */
    selectNewOrderCount: state => state.summary?.counts.newOrders ?? 0,
  },
});

export const { loadTodayAsync, resumeStoreAsync } = storeTodaySlice.actions;
export const { selectStoreToday, selectNewOrderCount } = storeTodaySlice.selectors;
