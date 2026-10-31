// MetroMatrix — Kitchen growth: tiffin. The kitchen's plans, its subscribers
// at a glance, and tomorrow's tiffins per plan.

import { createAppSlice } from '../../store/createAppSlice';
import { getTiffinTomorrowAPI, getMyTiffinPlansAPI, getTiffinSubscriptionsAPI } from '../../networks/foodGrowth/tiffinNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import type { TiffinInbox, TiffinPlan, TiffinTomorrow } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { tiffinPlansSerializer, tiffinInboxSerializer, tiffinTomorrowSerializer } from '../../serializers/kitchen/growthSerializer';

export interface TiffinPlansSliceState {
  plans: TiffinPlan[];
  counts: TiffinInbox['counts'] | null;
  tomorrow: TiffinTomorrow | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: TiffinPlansSliceState = { plans: [], counts: null, tomorrow: null, status: 'idle', error: NO_ERROR };

export const tiffinPlansSlice = createAppSlice({
  name: 'tiffinPlans',
  initialState,
  reducers: create => ({
    loadTiffinPlansAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          const [plans, inbox, tomorrow] = await Promise.all([getMyTiffinPlansAPI().then(raw => required(tiffinPlansSerializer(raw))), getTiffinSubscriptionsAPI().then(raw => required(tiffinInboxSerializer(raw))), getTiffinTomorrowAPI().then(raw => required(tiffinTomorrowSerializer(raw)))]);
          return { plans, counts: inbox.counts, tomorrow };
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
          state.plans = action.payload.plans;
          state.counts = action.payload.counts;
          state.tomorrow = action.payload.tomorrow;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your tiffin plans didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectTiffinPlans: state => state,
  },
});

export const { loadTiffinPlansAsync } = tiffinPlansSlice.actions;
export const { selectTiffinPlans } = tiffinPlansSlice.selectors;
