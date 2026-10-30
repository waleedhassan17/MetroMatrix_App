// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor delivery zones (fee bands by distance)
// ═══════════════════════════════════════════════════════
// Bands follow each other from 0 km: each starts where the one before ends,
// so the vendor only types where each band ends, its fee and its minimum
// order. Read with the settings (the radius caps the last band).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { getFeeBandsAPI, getVendorSettingsAPI, saveFeeBandsAPI } from '@networks/food/vendor/settingsNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import { MAX_FEE_BANDS, bandsFromForm, feeBandForm, type FeeBandForm } from '@models/food/vendorModel';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { feeBandsSerializer, vendorSettingsSerializer } from '@serializers/food/vendorSerializer';

export interface VendorZonesSliceState {
  rows: FeeBandForm[];
  maxRadiusKm: number;
  kitchen: { lat: number; lng: number } | null;
  status: FormStatus;
  saving: boolean;
  dirty: boolean;
  submitted: boolean;
  error: ServerError;
}

const initialState: VendorZonesSliceState = {
  rows: [],
  maxRadiusKm: 5,
  kitchen: null,
  status: 'idle',
  saving: false,
  dirty: false,
  submitted: false,
  error: NO_ERROR,
};

export const vendorZonesSlice = createAppSlice({
  name: 'vendorZones',
  initialState,
  reducers: create => ({
    addBand: create.reducer(state => {
      if (state.rows.length >= MAX_FEE_BANDS) return;
      const last = state.rows.length ? Number(state.rows[state.rows.length - 1].toKm) || 0 : 0;
      const to = Math.min(state.maxRadiusKm, last + 2);
      state.rows.push({ toKm: String(to > last ? to : last + 1), fee: state.rows.length ? '149' : '99', minOrder: state.rows.length ? '800' : '500' });
      state.dirty = true;
    }),
    removeBand: create.reducer((state, action: PayloadAction<number>) => {
      state.rows.splice(action.payload, 1);
      state.dirty = true;
    }),
    setBandField: create.reducer((state, action: PayloadAction<{ index: number; field: keyof FeeBandForm; value: string }>) => {
      const row = state.rows[action.payload.index];
      if (row) row[action.payload.field] = action.payload.value;
      state.dirty = true;
      state.error = NO_ERROR;
    }),
    markZonesSubmitted: create.reducer(state => {
      state.submitted = true;
    }),
    loadZonesAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          const [bands, settings] = await Promise.all([getFeeBandsAPI().then(raw => required(feeBandsSerializer(raw))), getVendorSettingsAPI().then(raw => required(vendorSettingsSerializer(raw)))]);
          return { bands, settings };
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
          const { bands, settings } = action.payload;
          state.status = 'succeeded';
          state.rows = bands.map(feeBandForm);
          state.maxRadiusKm = settings.maxRadiusKm;
          const { lat, lng } = settings.location;
          state.kitchen = lat !== null && lng !== null ? { lat, lng } : null;
          state.dirty = false;
          state.submitted = false;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your delivery zones didn't load.");
        },
      },
    ),
    saveZonesAsync: create.asyncThunk(
      async (rows: FeeBandForm[], { rejectWithValue }) => {
        try {
          return required(feeBandsSerializer(await saveFeeBandsAPI(bandsFromForm(rows))));
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
          state.rows = action.payload.map(feeBandForm);
          state.dirty = false;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "Your delivery zones didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorZones: state => state,
  },
});

export const { addBand, removeBand, setBandField, markZonesSubmitted, loadZonesAsync, saveZonesAsync } = vendorZonesSlice.actions;
export const { selectVendorZones } = vendorZonesSlice.selectors;
