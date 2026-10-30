// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor settings (how the branch works)
// ═══════════════════════════════════════════════════════
// Delivery and pick-up, cash and transfers, timings, the delivery radius and
// the kitchen's address with its map pin. The form is strings for typing;
// vendorModel turns it into the API's PATCH.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { getVendorSettingsAPI, updateVendorSettingsAPI } from '@networks/food/vendor/settingsNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import { settingsForm, settingsPatch, type VendorSettingsForm } from '@models/food/vendorModel';
import type { VendorSettings } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { vendorSettingsSerializer } from '@serializers/food/vendorSerializer';

export interface VendorSettingsSliceState {
  settings: VendorSettings | null;
  form: VendorSettingsForm | null;
  status: FormStatus;
  saving: boolean;
  submitted: boolean;
  error: ServerError;
}

const initialState: VendorSettingsSliceState = { settings: null, form: null, status: 'idle', saving: false, submitted: false, error: NO_ERROR };

export const vendorSettingsSlice = createAppSlice({
  name: 'vendorSettings',
  initialState,
  reducers: create => ({
    setSettingsField: create.reducer(
      <K extends keyof VendorSettingsForm>(state: VendorSettingsSliceState, action: PayloadAction<{ field: K; value: VendorSettingsForm[K] }>) => {
        if (state.form) state.form[action.payload.field] = action.payload.value;
        state.error = NO_ERROR;
      },
    ),
    setSettingsPin: create.reducer((state, action: PayloadAction<{ lat: number; lng: number }>) => {
      if (!state.form) return;
      state.form.lat = action.payload.lat;
      state.form.lng = action.payload.lng;
    }),
    markSettingsSubmitted: create.reducer(state => {
      state.submitted = true;
    }),
    loadVendorSettingsAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(vendorSettingsSerializer(await getVendorSettingsAPI()));
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
          state.settings = action.payload;
          state.form = settingsForm(action.payload);
          state.submitted = false;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your settings didn't load.");
        },
      },
    ),
    saveVendorSettingsAsync: create.asyncThunk(
      async (form: VendorSettingsForm, { rejectWithValue }) => {
        try {
          return required(vendorSettingsSerializer(await updateVendorSettingsAPI(settingsPatch(form))));
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
          state.saving = false;
          state.settings = action.payload;
          state.form = settingsForm(action.payload);
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "Your settings didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorSettings: state => state,
  },
});

export const { setSettingsField, setSettingsPin, markSettingsSubmitted, loadVendorSettingsAsync, saveVendorSettingsAsync } = vendorSettingsSlice.actions;
export const { selectVendorSettings } = vendorSettingsSlice.selectors;
