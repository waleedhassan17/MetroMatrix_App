// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor brand (name, logo, cover, cuisines, colour)
// ═══════════════════════════════════════════════════════
// Loads the profile and the cuisine list together; uploads go straight to
// the media store (purpose food_branding) and only their URLs are saved.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { getCuisinesAPI, getVendorProfileAPI, updateVendorProfileAPI } from '../../networks/food/vendor/profileNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import { brandPatch, MAX_CUISINES, type VendorBrandForm } from '../../models/food/vendorModel';
import type { FoodCuisine, LocalFile, VendorProfile } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { upload } from '../shared/photoUploads';
import { vendorProfileSerializer, foodCuisinesSerializer } from '../../serializers/food/vendorSerializer';

export interface VendorBrandSliceState {
  profile: VendorProfile | null;
  cuisines: FoodCuisine[];
  form: VendorBrandForm | null;
  status: FormStatus;
  saving: boolean;
  uploading: 'logo' | 'cover' | null;
  submitted: boolean;
  error: ServerError;
}

const initialState: VendorBrandSliceState = {
  profile: null,
  cuisines: [],
  form: null,
  status: 'idle',
  saving: false,
  uploading: null,
  submitted: false,
  error: NO_ERROR,
};

const formOf = (p: VendorProfile): VendorBrandForm => ({
  name: p.name,
  tagline: p.tagline ?? '',
  logoUrl: p.logoUrl,
  coverUrl: p.coverUrl,
  cuisineIds: p.cuisines.map(c => c.id),
  priceLevel: p.priceLevel,
  brandColor: p.brandColor,
});

export const vendorBrandSlice = createAppSlice({
  name: 'vendorBrand',
  initialState,
  reducers: create => ({
    setBrandField: create.reducer(<K extends keyof VendorBrandForm>(state: VendorBrandSliceState, action: PayloadAction<{ field: K; value: VendorBrandForm[K] }>) => {
      if (state.form) state.form[action.payload.field] = action.payload.value;
      state.error = NO_ERROR;
    }),
    toggleCuisine: create.reducer((state, action: PayloadAction<string>) => {
      if (!state.form) return;
      const ids = state.form.cuisineIds;
      if (ids.includes(action.payload)) state.form.cuisineIds = ids.filter(id => id !== action.payload);
      else if (ids.length < MAX_CUISINES) state.form.cuisineIds = [...ids, action.payload];
    }),
    markBrandSubmitted: create.reducer(state => {
      state.submitted = true;
    }),
    loadVendorBrandAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          const [profile, cuisines] = await Promise.all([getVendorProfileAPI().then(raw => required(vendorProfileSerializer(raw))), getCuisinesAPI().then(raw => required(foodCuisinesSerializer(raw)))]);
          return { profile, cuisines };
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
          state.profile = action.payload.profile;
          state.cuisines = action.payload.cuisines;
          state.form = formOf(action.payload.profile);
          state.submitted = false;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your brand didn't load.");
        },
      },
    ),
    uploadBrandImageAsync: create.asyncThunk(
      async ({ kind, file }: { kind: 'logo' | 'cover'; file: LocalFile }, { rejectWithValue }) => {
        try {
          return await upload(file, kind === 'logo' ? 'food_logo' : 'food_cover', () => undefined);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.uploading = action.meta.arg.kind;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.uploading = null;
          if (state.form) state.form[action.meta.arg.kind === 'logo' ? 'logoUrl' : 'coverUrl'] = action.payload.url;
        },
        rejected: (state, action) => {
          state.uploading = null;
          state.error = readRejection(action, "The image didn't upload.");
        },
      },
    ),
    saveVendorBrandAsync: create.asyncThunk(
      async (form: VendorBrandForm, { rejectWithValue }) => {
        try {
          return required(vendorProfileSerializer(await updateVendorProfileAPI(brandPatch(form))));
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
          state.profile = action.payload;
          state.form = formOf(action.payload);
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "Your brand didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorBrand: state => state,
  },
});

export const { setBrandField, toggleCuisine, markBrandSubmitted, loadVendorBrandAsync, uploadBrandImageAsync, saveVendorBrandAsync } =
  vendorBrandSlice.actions;
export const { selectVendorBrand } = vendorBrandSlice.selectors;
