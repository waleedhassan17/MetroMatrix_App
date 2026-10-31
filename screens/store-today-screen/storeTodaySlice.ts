// MetroMatrix — Store "Today" slice: the counts to act on, a week of recorded
// sales, the newest orders, and opening the store again after a pause.

import { createAppSlice } from '../../store/createAppSlice';
import { getPartnerSummaryAPI, resumeStoreAPI } from '../../networks/shopping/partner/storeNetwork';
import { getPartnerOrdersAPI } from '../../networks/shopping/partner/partnerOrdersNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import type { PartnerOrderRow, PartnerSummary } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { partnerSummarySerializer, partnerOrderPageSerializer } from '../../serializers/shopping/partnerSerializer';

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
          const [summary, recent] = await Promise.all([getPartnerSummaryAPI().then(raw => required(partnerSummarySerializer(raw))), getPartnerOrdersAPI({ segment: 'new' }, 1, 5).then(raw => required(partnerOrderPageSerializer(raw)))]);
          return { summary, recent: recent.items };
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
          state.summary = action.payload.summary;
          state.recent = action.payload.recent;
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
          await resumeStoreAPI();
          return required(partnerSummarySerializer(await getPartnerSummaryAPI()));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.resuming = true;
        },
        fulfilled: (state, action) => {
          state.resuming = false;
          state.summary = action.payload;
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
  },
});

export const { loadTodayAsync, resumeStoreAsync } = storeTodaySlice.actions;
export const { selectStoreToday } = storeTodaySlice.selectors;
