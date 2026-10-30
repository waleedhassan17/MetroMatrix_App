// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Food banner form slice
// ═══════════════════════════════════════════════════════
// One banner as staff edit it, the vendors and cuisines it can open, the
// picture's upload, save and delete. Dates are Pakistan days: a banner
// shows from the start of its first day to the end of its last.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import {
  createFoodBanner,
  deleteFoodBanner,
  listAdminCuisines,
  listAdminFoodVendors,
  updateFoodBanner,
} from '@networks/admin/adminFoodNetwork';
import { uploadImage } from '@/services/mediaUpload';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type {
  AdminCuisine,
  AdminFoodBanner,
  AdminFoodBannerInput,
  AdminFoodVendorRow,
  FoodBannerTargetType,
  LocalFile,
} from '@/types';
import {
  NO_ERROR,
  readRejection,
  type FormStatus,
  type ServerError,
} from '../../../Auth/shared/formStatus';

export interface FoodBannerForm {
  imageUrl: string;
  title: string;
  subtitle: string;
  targetType: FoodBannerTargetType;
  targetId: string;
  targetQuery: string;
  /** '' for every city. */
  city: string;
  /** YYYY-MM-DD, Pakistan days. */
  startsAt: string;
  endsAt: string;
  sort: number;
  isActive: boolean;
}

export interface AdminFoodBannerFormSliceState {
  id: string | null;
  form: FoodBannerForm;
  vendors: AdminFoodVendorRow[];
  cuisines: AdminCuisine[];
  uploading: boolean;
  submitted: boolean;
  status: FormStatus;
  error: ServerError;
}

const PKT_OFFSET = '+05:00';
const today = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);

export const emptyFoodBannerForm = (sort: number): FoodBannerForm => ({
  imageUrl: '',
  title: '',
  subtitle: '',
  targetType: 'vendor',
  targetId: '',
  targetQuery: '',
  city: '',
  startsAt: today(),
  endsAt: '',
  sort,
  isActive: true,
});

const pkDay = (iso: string) => new Date(Date.parse(iso) + 5 * 3_600_000).toISOString().slice(0, 10);

export const fromFoodBanner = (b: AdminFoodBanner): FoodBannerForm => ({
  imageUrl: b.imageUrl,
  title: b.title,
  subtitle: b.subtitle ?? '',
  targetType: b.targetType,
  targetId: b.targetId ?? '',
  targetQuery: b.targetQuery ?? '',
  city: b.city ?? '',
  startsAt: pkDay(b.startsAt),
  endsAt: b.endsAt ? pkDay(b.endsAt) : '',
  sort: b.sort,
  isActive: b.isActive,
});

export const toFoodBannerInput = (f: FoodBannerForm): AdminFoodBannerInput => ({
  imageUrl: f.imageUrl,
  title: f.title.trim(),
  subtitle: f.subtitle.trim() || null,
  targetType: f.targetType,
  targetId: f.targetType === 'search' ? null : f.targetId || null,
  targetQuery: f.targetType === 'search' ? f.targetQuery.trim() || null : null,
  city: f.city.trim() || null,
  startsAt: new Date(`${f.startsAt}T00:00:00${PKT_OFFSET}`).toISOString(),
  endsAt: f.endsAt ? new Date(`${f.endsAt}T23:59:59${PKT_OFFSET}`).toISOString() : null,
  sort: f.sort,
  isActive: f.isActive,
});

const initialState: AdminFoodBannerFormSliceState = {
  id: null,
  form: emptyFoodBannerForm(0),
  vendors: [],
  cuisines: [],
  uploading: false,
  submitted: false,
  status: 'idle',
  error: NO_ERROR,
};

export const adminFoodBannerFormSlice = createAppSlice({
  name: 'adminFoodBannerForm',
  initialState,
  reducers: create => ({
    startFoodBannerForm: create.reducer(
      (state, action: PayloadAction<{ id: string | null; form: FoodBannerForm }>) => ({
        ...initialState,
        vendors: state.vendors,
        cuisines: state.cuisines,
        id: action.payload.id,
        form: action.payload.form,
      }),
    ),
    setFoodBannerField: create.reducer(
      (
        state,
        action: PayloadAction<{
          field: keyof FoodBannerForm;
          value: FoodBannerForm[keyof FoodBannerForm];
        }>,
      ) => {
        (state.form as unknown as Record<string, unknown>)[action.payload.field] =
          action.payload.value;
        if (action.payload.field === 'targetType') state.form.targetId = '';
      },
    ),
    markFoodBannerSubmitted: create.reducer(state => {
      state.submitted = true;
    }),

    loadFoodBannerChoicesAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          const [vendors, cuisines] = await Promise.all([
            listAdminFoodVendors({ status: 'live' }, 1, 100),
            listAdminCuisines(),
          ]);
          return { vendors: vendors.items, cuisines: cuisines.filter(c => c.isActive) };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          state.vendors = action.payload.vendors;
          state.cuisines = action.payload.cuisines;
        },
        rejected: (state, action) => {
          state.error = readRejection(action, "We couldn't load the vendors and cuisines.");
        },
      },
    ),

    uploadFoodBannerImageAsync: create.asyncThunk(
      async (file: LocalFile, { rejectWithValue }) => {
        try {
          return await uploadImage(file, 'banner_image');
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.uploading = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.uploading = false;
          state.form.imageUrl = action.payload.url;
        },
        rejected: (state, action) => {
          state.uploading = false;
          state.error = readRejection(action, "The picture didn't upload. Try again.");
        },
      },
    ),

    saveFoodBannerAsync: create.asyncThunk(
      async (
        { id, input }: { id: string | null; input: AdminFoodBannerInput },
        { rejectWithValue },
      ) => {
        try {
          return id ? await updateFoodBanner(id, input) : await createFoodBanner(input);
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
          state.error = readRejection(action, "The banner wasn't saved.");
        },
      },
    ),

    deleteFoodBannerAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return await deleteFoodBanner(id);
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
          state.error = readRejection(action, "The banner wasn't deleted.");
        },
      },
    ),
  }),
  selectors: {
    selectAdminFoodBannerForm: state => state,
  },
});

export const {
  startFoodBannerForm,
  setFoodBannerField,
  markFoodBannerSubmitted,
  loadFoodBannerChoicesAsync,
  uploadFoodBannerImageAsync,
  saveFoodBannerAsync,
  deleteFoodBannerAsync,
} = adminFoodBannerFormSlice.actions;
export const { selectAdminFoodBannerForm } = adminFoodBannerFormSlice.selectors;
