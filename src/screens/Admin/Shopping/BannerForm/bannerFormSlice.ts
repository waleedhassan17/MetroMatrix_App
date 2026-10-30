// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin banner form slice
// ═══════════════════════════════════════════════════════

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { createBannerAPI, deleteBannerAPI, getAdminCategoriesAPI, getAdminStoresAPI, updateBannerAPI } from '@networks/admin/adminShopNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { AdminBanner, AdminBannerInput, LocalFile, ShopCategory, StoreSummary } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { upload } from '../../../Shopping/Customer/shared/photoUploads';
import { storeSummaryPageSerializer, categoryListSerializer } from '@serializers/shopping/catalogSerializer';
import { adminBannerSerializer } from '@serializers/shopping/adminShopSerializer';

export interface BannerForm {
  imageUrl: string;
  headline: string;
  subhead: string;
  kind: 'store' | 'category' | 'product';
  /** A store slug, a category id or a product id. */
  ref: string;
  /** YYYY-MM-DD */
  startsAt: string;
  endsAt: string;
  position: number;
  isActive: boolean;
}

export interface BannerFormSliceState {
  id: string | null;
  form: BannerForm;
  stores: StoreSummary[];
  categories: ShopCategory[];
  uploading: boolean;
  submitted: boolean;
  status: FormStatus;
  error: ServerError;
}

const today = () => new Date().toISOString().slice(0, 10);

export const emptyBannerForm = (position: number): BannerForm => ({
  imageUrl: '',
  headline: '',
  subhead: '',
  kind: 'store',
  ref: '',
  startsAt: today(),
  endsAt: '',
  position,
  isActive: true,
});

export const fromBanner = (b: AdminBanner): BannerForm => ({
  imageUrl: b.imageUrl,
  headline: b.headline,
  subhead: b.subhead ?? '',
  kind: b.target.kind,
  ref: b.target.kind === 'store' ? b.target.slug : b.target.id,
  startsAt: b.startsAt.slice(0, 10),
  endsAt: b.endsAt ? b.endsAt.slice(0, 10) : '',
  position: b.position,
  isActive: b.isActive,
});

export const validateBannerForm = (f: BannerForm): Record<string, string> => {
  const e: Record<string, string> = {};
  if (!f.imageUrl) e.imageUrl = 'Add an image';
  if (f.headline.trim().length < 3) e.headline = 'Write a headline';
  if (!f.ref.trim()) e.ref = 'Choose where it leads';
  if (f.endsAt && f.endsAt < f.startsAt) e.endsAt = 'Ends before it starts';
  return e;
};

export const toBannerInput = (f: BannerForm, categories: ShopCategory[]): AdminBannerInput => {
  const cat = categories.flatMap(c => [c, ...c.children]).find(c => c.id === f.ref);
  return {
    imageUrl: f.imageUrl,
    headline: f.headline.trim(),
    subhead: f.subhead.trim() || null,
    target:
      f.kind === 'store'
        ? { kind: 'store', slug: f.ref.trim() }
        : f.kind === 'category'
          ? { kind: 'category', id: f.ref, name: cat?.name ?? '' }
          : { kind: 'product', id: f.ref.trim() },
    startsAt: new Date(`${f.startsAt}T00:00:00`).toISOString(),
    endsAt: f.endsAt ? new Date(`${f.endsAt}T23:59:59`).toISOString() : null,
    position: f.position,
    isActive: f.isActive,
  };
};

const initialState: BannerFormSliceState = {
  id: null,
  form: emptyBannerForm(0),
  stores: [],
  categories: [],
  uploading: false,
  submitted: false,
  status: 'idle',
  error: NO_ERROR,
};

export const bannerFormSlice = createAppSlice({
  name: 'bannerForm',
  initialState,
  reducers: create => ({
    startBannerForm: create.reducer((state, action: PayloadAction<{ id: string | null; form: BannerForm }>) => ({
      ...initialState,
      stores: state.stores,
      categories: state.categories,
      id: action.payload.id,
      form: action.payload.form,
    })),
    setBannerField: create.reducer(<K extends keyof BannerForm>(state: BannerFormSliceState, action: PayloadAction<{ field: K; value: BannerForm[K] }>) => {
      state.form[action.payload.field] = action.payload.value;
      if (action.payload.field === 'kind') state.form.ref = '';
    }),
    markBannerSubmitted: create.reducer(state => {
      state.submitted = true;
    }),
    loadBannerChoicesAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          const [stores, categories] = await Promise.all([getAdminStoresAPI('', 1, 100).then(raw => required(storeSummaryPageSerializer(raw))), getAdminCategoriesAPI().then(raw => required(categoryListSerializer(raw)))]);
          return { stores: stores.items, categories };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          state.stores = action.payload.stores;
          state.categories = action.payload.categories;
        },
      },
    ),
    uploadBannerImageAsync: create.asyncThunk(
      async (file: LocalFile, { rejectWithValue }) => {
        try {
          return await upload(file, 'banner_image', () => undefined);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.uploading = true;
        },
        fulfilled: (state, action) => {
          state.uploading = false;
          state.form.imageUrl = action.payload.url;
        },
        rejected: (state, action) => {
          state.uploading = false;
          state.error = readRejection(action, "The image didn't upload.");
        },
      },
    ),
    saveBannerAsync: create.asyncThunk(
      async ({ id, input }: { id: string | null; input: AdminBannerInput }, { rejectWithValue }) => {
        try {
          return id ? required(adminBannerSerializer(await updateBannerAPI(id, input))) : required(adminBannerSerializer(await createBannerAPI(input)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.status = 'succeeded';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't save the banner.");
        },
      },
    ),
    deleteBannerAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return await deleteBannerAPI(id);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        rejected: (state, action) => {
          state.error = readRejection(action, "We couldn't delete the banner.");
        },
      },
    ),
  }),
  selectors: {
    selectBannerForm: state => state,
  },
});

export const { startBannerForm, setBannerField, markBannerSubmitted, loadBannerChoicesAsync, uploadBannerImageAsync, saveBannerAsync, deleteBannerAsync } =
  bannerFormSlice.actions;
export const { selectBannerForm } = bannerFormSlice.selectors;
