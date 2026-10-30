// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: one rider
// ═══════════════════════════════════════════════════════
// Change their phone or vehicle; mark them active, on leave or inactive
// (inactive signs them out); reset the password (shown once); the cash they
// hold for the kitchen, and recording what they hand over.

import { createAppSlice } from '@store/createAppSlice';
import type { PayloadAction } from '@reduxjs/toolkit';
import { getRiderAPI, getRiderCashForVendorAPI, recordHandoverAPI, resetRiderPasswordAPI, setRiderStatusAPI, updateRiderAPI } from '@networks/food/vendor/ridersNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { FoodRider, RiderCash, RiderCredential, RiderInput } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { riderUpdated } from '../VendorRiders/vendorRidersSlice';
import { riderCashSerializer, foodRiderSerializer, riderCredentialSerializer } from '@serializers/food/riderSerializer';

export interface RiderDetailSliceState {
  rider: FoodRider | null;
  status: FormStatus;
  busy: 'status' | 'save' | 'reset' | null;
  credential: RiderCredential | null;
  error: ServerError;
  cash: RiderCash | null;
  /** The handover sheet: open, and the amount typed (rupees). */
  handoverOpen: boolean;
  handoverAmount: string;
  handoverNote: string;
  handing: boolean;
  handoverError: ServerError;
}

const initialState: RiderDetailSliceState = {
  rider: null,
  status: 'idle',
  busy: null,
  credential: null,
  error: NO_ERROR,
  cash: null,
  handoverOpen: false,
  handoverAmount: '',
  handoverNote: '',
  handing: false,
  handoverError: NO_ERROR,
};

export const riderDetailSlice = createAppSlice({
  name: 'riderDetail',
  initialState,
  reducers: create => ({
    clearRiderCredential: create.reducer(state => {
      state.credential = null;
    }),
    openHandover: create.reducer((state, action: PayloadAction<boolean>) => {
      state.handoverOpen = action.payload;
      state.handoverError = NO_ERROR;
      state.handoverAmount = action.payload && state.cash ? String(Math.max(0, state.cash.balance)) : '';
      state.handoverNote = '';
    }),
    setHandoverAmount: create.reducer((state, action: PayloadAction<string>) => {
      state.handoverAmount = action.payload.replace(/[^\d]/g, '').slice(0, 7);
    }),
    setHandoverNote: create.reducer((state, action: PayloadAction<string>) => {
      state.handoverNote = action.payload.slice(0, 200);
    }),
    loadRiderCashAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return required(riderCashSerializer(await getRiderCashForVendorAPI(id)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          if (state.cash?.riderId !== action.meta.arg) state.cash = null;
        },
        fulfilled: (state, action) => {
          state.cash = action.payload;
        },
      },
    ),
    recordHandoverAsync: create.asyncThunk(
      async ({ id, amount, note }: { id: string; amount: number; note: string | null }, { rejectWithValue }) => {
        try {
          return required(riderCashSerializer(await recordHandoverAPI(id, amount, note)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.handing = true;
          state.handoverError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.handing = false;
          state.handoverOpen = false;
          state.cash = action.payload;
        },
        rejected: (state, action) => {
          state.handing = false;
          state.handoverError = readRejection(action, "The handover wasn't recorded.");
        },
      },
    ),
    loadRiderAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return required(foodRiderSerializer(await getRiderAPI(id)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.status = 'loading';
          state.error = NO_ERROR;
          if (state.rider?.id !== action.meta.arg) state.rider = null;
          state.credential = null;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.rider = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The rider didn't load.");
        },
      },
    ),
    setRiderStatusAsync: create.asyncThunk(
      async ({ id, status }: { id: string; status: 'active' | 'inactive' | 'on_leave' }, { dispatch, rejectWithValue }) => {
        try {
          const rider = required(foodRiderSerializer(await setRiderStatusAPI(id, status)));
          dispatch(riderUpdated(rider));
          return rider;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = 'status';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = null;
          state.rider = action.payload;
        },
        rejected: (state, action) => {
          state.busy = null;
          state.error = readRejection(action, "That didn't change.");
        },
      },
    ),
    saveRiderAsync: create.asyncThunk(
      async ({ id, input }: { id: string; input: Partial<RiderInput> }, { dispatch, rejectWithValue }) => {
        try {
          const rider = required(foodRiderSerializer(await updateRiderAPI(id, input)));
          dispatch(riderUpdated(rider));
          return rider;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = 'save';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = null;
          state.rider = action.payload;
        },
        rejected: (state, action) => {
          state.busy = null;
          state.error = readRejection(action, "That didn't save.");
        },
      },
    ),
    resetRiderPasswordAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return required(riderCredentialSerializer(await resetRiderPasswordAPI(id)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = 'reset';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = null;
          state.credential = action.payload;
        },
        rejected: (state, action) => {
          state.busy = null;
          state.error = readRejection(action, "The password wasn't reset.");
        },
      },
    ),
  }),
  selectors: {
    selectRiderDetail: state => state,
  },
});

export const {
  clearRiderCredential,
  openHandover,
  setHandoverAmount,
  setHandoverNote,
  loadRiderCashAsync,
  recordHandoverAsync,
  loadRiderAsync,
  setRiderStatusAsync,
  saveRiderAsync,
  resetRiderPasswordAsync,
} = riderDetailSlice.actions;
export const { selectRiderDetail } = riderDetailSlice.selectors;
