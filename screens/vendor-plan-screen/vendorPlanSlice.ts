// MetroMatrix — Food vendor plan: the free Community plan and what's used of it.
import { createAppSlice } from '../../store/createAppSlice';
import { fetchVendorPlan } from '../../networks/food/vendor/plan';
import { toRejectedValue, required } from '../../networks/network/network';
import type { VendorPlan } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { vendorPlanSerializer } from '../../serializers/food/vendorSerializer';

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
          return await fetchVendorPlan();
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
          const payload = vendorPlanSerializer(action.payload);
          state.status = 'succeeded';
          state.plan = payload;
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
