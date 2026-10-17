// MetroMatrix — Food vendor plan: the free Community plan and what's used of it.
import { createAppSlice } from '@store/createAppSlice';
import { getVendorPlan } from '@networks/food/vendor/planNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { VendorPlan } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export interface VendorPlanSliceState {
  plan: VendorPlan | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: VendorPlanSliceState = { plan: null, status: 'idle', error: NO_ERROR };

export const vendorPlanSlice = createAppSlice({
  name: 'vendorPlan',
  initialState,
  reducers: create => ({
    loadVendorPlanAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await getVendorPlan();
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
          state.plan = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your plan didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorPlan: state => state,
  },
});

export const { loadVendorPlanAsync } = vendorPlanSlice.actions;
export const { selectVendorPlan } = vendorPlanSlice.selectors;
