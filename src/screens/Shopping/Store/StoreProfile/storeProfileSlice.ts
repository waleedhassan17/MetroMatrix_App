// ═══════════════════════════════════════════════════════
// MetroMatrix — Store profile slice (how the store looks to customers)
// ═══════════════════════════════════════════════════════

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { getStoreProfileAPI, updateStoreProfileAPI } from '@networks/shopping/partner/storeNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import { normaliseHex } from '@models/shopping/storeModel';
import type { LocalFile, StoreProfile, StoreProfileInput } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { upload } from '../../Customer/shared/photoUploads';
import { storeProfileSerializer } from '@serializers/shopping/partnerSerializer';

export interface StoreProfileSliceState {
  profile: StoreProfile | null;
  form: StoreProfileInput | null;
  status: FormStatus;
  saveStatus: FormStatus;
  error: ServerError;
  uploading: 'logo' | 'cover' | null;
}

const initialState: StoreProfileSliceState = { profile: null, form: null, status: 'idle', saveStatus: 'idle', error: NO_ERROR, uploading: null };

const toForm = (p: StoreProfile): StoreProfileInput => ({
  tagline: p.tagline,
  about: p.about,
  logoUrl: p.logoUrl,
  coverUrl: p.coverUrl,
  brandColor: p.brandColor,
  onBrandColor: p.onBrandColor,
  socials: p.socials,
  phone: p.phone,
  whatsapp: p.whatsapp,
});

export const storeProfileSlice = createAppSlice({
  name: 'storeProfile',
  initialState,
  reducers: create => ({
    setProfileField: create.reducer(
      <K extends keyof StoreProfileInput>(state: StoreProfileSliceState, action: PayloadAction<{ field: K; value: StoreProfileInput[K] }>) => {
        if (!state.form) return;
        const { field, value } = action.payload;
        state.form[field] = (field === 'brandColor' ? normaliseHex(String(value)) : value) as StoreProfileInput[K];
      },
    ),
    setSocial: create.reducer((state, action: PayloadAction<{ key: keyof StoreProfileInput['socials']; value: string }>) => {
      if (state.form) state.form.socials[action.payload.key] = action.payload.value.trim() || null;
    }),
    loadStoreProfileAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(storeProfileSerializer(await getStoreProfileAPI()));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.profile = action.payload;
          state.form = toForm(action.payload);
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't load your store profile.");
        },
      },
    ),
    uploadStoreImageAsync: create.asyncThunk(
      async ({ kind, file }: { kind: 'logo' | 'cover'; file: LocalFile }, { rejectWithValue }) => {
        try {
          return await upload(file, kind === 'logo' ? 'store_logo' : 'store_cover', () => undefined);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.uploading = action.meta.arg.kind;
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
    saveStoreProfileAsync: create.asyncThunk(
      async (input: StoreProfileInput, { rejectWithValue }) => {
        try {
          return required(storeProfileSerializer(await updateStoreProfileAPI(input)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saveStatus = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.saveStatus = 'succeeded';
          state.profile = action.payload;
          state.form = toForm(action.payload);
        },
        rejected: (state, action) => {
          state.saveStatus = 'failed';
          state.error = readRejection(action, "We couldn't save your profile.");
        },
      },
    ),
  }),
  selectors: {
    selectStoreProfile: state => state,
  },
});

export const { setProfileField, setSocial, loadStoreProfileAsync, uploadStoreImageAsync, saveStoreProfileAsync } = storeProfileSlice.actions;
export const { selectStoreProfile } = storeProfileSlice.selectors;
