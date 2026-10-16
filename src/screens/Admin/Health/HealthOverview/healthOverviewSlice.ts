// MetroMatrix — Admin Health overview slice.

import { createAppSlice } from '@store/createAppSlice';
import { getHealthOverview } from '@networks/admin/adminHealthNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { HealthOverview } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export interface HealthOverviewSliceState {
  overview: HealthOverview | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: HealthOverviewSliceState = { overview: null, status: 'idle', error: NO_ERROR };

export const healthOverviewSlice = createAppSlice({
  name: 'healthOverview',
  initialState,
  reducers: create => ({
    loadHealthOverviewAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await getHealthOverview();
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
          state.overview = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't load the overview.");
        },
      },
    ),
  }),
  selectors: {
    selectHealthOverview: state => state,
  },
});

export const { loadHealthOverviewAsync } = healthOverviewSlice.actions;
export const { selectHealthOverview } = healthOverviewSlice.selectors;
