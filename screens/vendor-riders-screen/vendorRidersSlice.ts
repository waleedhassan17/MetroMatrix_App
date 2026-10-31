// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor riders
// ═══════════════════════════════════════════════════════
// The vendor's own riders: add one (the API answers with a username and a
// password shown once), and open one to change, pause, reset or deactivate.
// Riders are optional: an order can be handed to anyone the vendor trusts.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { createRider, fetchRiders } from '../../networks/food/vendor/riders';
import { toRejectedValue, required } from '../../networks/network/network';
import { normalizePkPhone } from '../../utils/phone/phone';
import type { FoodRider, RiderCredential, RiderInput } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { foodRidersSerializer, createdRiderSerializer } from '../../serializers/food/riderSerializer';

export interface VendorRidersSliceState {
  riders: FoodRider[];
  status: FormStatus;
  /** The add-rider sheet: closed, the form, or the credential to hand over. */
  sheet: 'closed' | 'form' | 'credential';
  form: RiderInput;
  submitted: boolean;
  saving: boolean;
  created: { name: string; credential: RiderCredential } | null;
  error: ServerError;
}

const blank = (): RiderInput => ({ fullName: '', phone: '', vehicle: 'bike' });

const initialState: VendorRidersSliceState = {
  riders: [],
  status: 'idle',
  sheet: 'closed',
  form: blank(),
  submitted: false,
  saving: false,
  created: null,
  error: NO_ERROR,
};

export const vendorRidersSlice = createAppSlice({
  name: 'vendorRiders',
  initialState,
  reducers: create => ({
    openAddRider: create.reducer(state => {
      state.sheet = 'form';
      state.form = blank();
      state.submitted = false;
      state.created = null;
      state.error = NO_ERROR;
    }),
    closeAddRider: create.reducer(state => {
      state.sheet = 'closed';
      // The password is gone once the card closes.
      state.created = null;
    }),
    setRiderField: create.reducer((state, action: PayloadAction<{ field: keyof RiderInput; value: string }>) => {
      state.form[action.payload.field] = action.payload.value;
      state.error = NO_ERROR;
    }),
    markRiderSubmitted: create.reducer(state => {
      state.submitted = true;
    }),
    loadRidersAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await fetchRiders();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          if (state.sheet === 'closed') state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = foodRidersSerializer(action.payload);
          state.status = 'succeeded';
          state.riders = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your riders didn't load.");
        },
      },
    ),
    createRiderAsync: create.asyncThunk(
      async (input: RiderInput, { rejectWithValue }) => {
        try {
          return await createRider({
            fullName: input.fullName.trim(),
            phone: input.phone ? (normalizePkPhone(input.phone) ?? null) : null,
            vehicle: input.vehicle,
          });
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = createdRiderSerializer(action.payload);
          state.saving = false;
          if (!payload) return;
          state.riders = [payload.rider, ...state.riders.filter(r => r.id !== payload.rider.id)];
          state.created = { name: payload.rider.fullName, credential: payload.credential };
          state.sheet = 'credential';
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "The rider wasn't added.");
        },
      },
    ),
    /** A rider changed on their own page: keep the list in step. */
    riderUpdated: create.reducer((state, action: PayloadAction<FoodRider>) => {
      state.riders = state.riders.map(r => (r.id === action.payload.id ? action.payload : r));
    }),
  }),
  selectors: {
    selectVendorRiders: state => state,
  },
});

export const { openAddRider, closeAddRider, setRiderField, markRiderSubmitted, loadRidersAsync, createRiderAsync, riderUpdated } = vendorRidersSlice.actions;
export const { selectVendorRiders } = vendorRidersSlice.selectors;
