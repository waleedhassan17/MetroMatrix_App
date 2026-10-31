// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor setup (the checklist, then Go live)
// ═══════════════════════════════════════════════════════
// The server says what's done and whether the kitchen can go live; going
// live re-reads the session so the app knows (business.food.isLive).

import { createAppSlice } from '../../store/createAppSlice';
import { fetchVendorSetup, goLive } from '../../networks/food/vendor/setup';
import { toRejectedValue } from '../../networks/network/network';
import type { VendorSetup } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { refreshSession } from '../../Components/appContainerSlice';
import { vendorSetupSerializer } from '../../serializers/food/vendorSerializer';

export interface VendorSetupSliceState {
  setup: VendorSetup | null;
  status: FormStatus;
  goingLive: boolean;
  error: ServerError;
}

const initialState: VendorSetupSliceState = { setup: null, status: 'idle', goingLive: false, error: NO_ERROR };

export const vendorSetupSlice = createAppSlice({
  name: 'vendorSetup',
  initialState,
  reducers: create => ({
    loadVendorSetupAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await fetchVendorSetup();
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
          const payload = vendorSetupSerializer(action.payload);
          state.status = 'succeeded';
          state.setup = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your checklist didn't load.");
        },
      },
    ),
    goLiveAsync: create.asyncThunk(
      async (_: void, { dispatch, rejectWithValue }) => {
        try {
          await goLive();
          await dispatch(refreshSession());
          return await fetchVendorSetup();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.goingLive = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = vendorSetupSerializer(action.payload);
          state.goingLive = false;
          state.setup = payload;
        },
        rejected: (state, action) => {
          state.goingLive = false;
          state.error = readRejection(action, "You didn't go live yet. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorSetup: state => state,
  },
});

export const { loadVendorSetupAsync, goLiveAsync } = vendorSetupSlice.actions;
export const { selectVendorSetup } = vendorSetupSlice.selectors;
