// ═══════════════════════════════════════════════════════
// MetroMatrix — Food rider: who they are, duty, their deliveries
// ═══════════════════════════════════════════════════════
// Read by Deliveries, the delivery page and Profile: the rider and the
// vendor they deliver for, whether they're on duty (only then can they be
// given deliveries and share where they are), and the deliveries they're
// working now. History is a paged list (usePagedList).

import { createAppSlice } from '../../store/createAppSlice';
import { getRiderHomeAPI, getRiderOrdersAPI, setDutyAPI } from '../../networks/food/rider/riderNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import type { RiderHome, RiderOrder } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { riderHomeSerializer, riderOrdersPageSerializer, riderDutySerializer } from '../../serializers/food/riderSerializer';

export interface RiderHomeSliceState {
  home: RiderHome | null;
  status: FormStatus;
  error: ServerError;
  /** Deliveries being worked now (assigned, not yet delivered). */
  active: RiderOrder[];
  activeStatus: FormStatus;
  dutyBusy: boolean;
  dutyError: ServerError;
}

const initialState: RiderHomeSliceState = { home: null, status: 'idle', error: NO_ERROR, active: [], activeStatus: 'idle', dutyBusy: false, dutyError: NO_ERROR };

export const riderHomeSlice = createAppSlice({
  name: 'riderHome',
  initialState,
  reducers: create => ({
    loadRiderHomeAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(riderHomeSerializer(await getRiderHomeAPI()));
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
          state.home = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your details didn't load.");
        },
      },
    ),

    loadRiderDeliveriesAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return (required(riderOrdersPageSerializer(await getRiderOrdersAPI('active', 1, 50)))).items;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          if (state.activeStatus !== 'succeeded') state.activeStatus = 'loading';
        },
        fulfilled: (state, action) => {
          state.activeStatus = 'succeeded';
          state.active = action.payload;
        },
        rejected: state => {
          state.activeStatus = 'failed';
        },
      },
    ),

    setDutyAsync: create.asyncThunk(
      async (onDuty: boolean, { rejectWithValue }) => {
        try {
          return required(riderDutySerializer(await setDutyAPI(onDuty)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.dutyBusy = true;
          state.dutyError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.dutyBusy = false;
          if (state.home) state.home.rider.onDuty = action.payload;
        },
        rejected: (state, action) => {
          state.dutyBusy = false;
          state.dutyError = readRejection(action, "That didn't change.");
        },
      },
    ),
  }),
  selectors: {
    selectRiderHome: state => state,
  },
});

export const { loadRiderHomeAsync, loadRiderDeliveriesAsync, setDutyAsync } = riderHomeSlice.actions;
export const { selectRiderHome } = riderHomeSlice.selectors;
