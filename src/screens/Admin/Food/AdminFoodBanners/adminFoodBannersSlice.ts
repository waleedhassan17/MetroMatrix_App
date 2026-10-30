// MetroMatrix — Admin Food banners slice: the list, switching one on or
// off, and the order (the list is renumbered 0, 10, 20… as it now reads).

import { createAppSlice } from '@store/createAppSlice';
import { getAdminFoodBannersAPI, updateFoodBannerAPI } from '@networks/admin/adminFoodNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { AdminFoodBanner } from '@/types';
import {
  NO_ERROR,
  readRejection,
  type FormStatus,
  type ServerError,
} from '../../../Auth/shared/formStatus';
import { adminFoodBannersSerializer } from '@serializers/food/adminFoodSerializer';

export interface AdminFoodBannersSliceState {
  banners: AdminFoodBanner[];
  status: FormStatus;
  busy: boolean;
  error: ServerError;
}

const initialState: AdminFoodBannersSliceState = {
  banners: [],
  status: 'idle',
  busy: false,
  error: NO_ERROR,
};

type Change =
  | { kind: 'toggle'; banner: AdminFoodBanner }
  | { kind: 'order'; banners: AdminFoodBanner[] };

export const adminFoodBannersSlice = createAppSlice({
  name: 'adminFoodBanners',
  initialState,
  reducers: create => ({
    loadFoodBannersAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(adminFoodBannersSerializer(await getAdminFoodBannersAPI()));
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
          state.banners = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't load the banners.");
        },
      },
    ),
    changeFoodBannersAsync: create.asyncThunk(
      async (change: Change, { rejectWithValue }) => {
        try {
          if (change.kind === 'toggle')
            await updateFoodBannerAPI(change.banner.id, { isActive: !change.banner.isActive });
          else {
            for (const [i, b] of change.banners.entries())
              if (b.sort !== i * 10) await updateFoodBannerAPI(b.id, { sort: i * 10 });
          }
          return required(adminFoodBannersSerializer(await getAdminFoodBannersAPI()));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = false;
          state.banners = action.payload;
        },
        rejected: (state, action) => {
          state.busy = false;
          state.error = readRejection(action, "That didn't go through.");
        },
      },
    ),
  }),
  selectors: {
    selectAdminFoodBanners: state => state,
  },
});

export const { loadFoodBannersAsync, changeFoodBannersAsync } = adminFoodBannersSlice.actions;
export const { selectAdminFoodBanners } = adminFoodBannersSlice.selectors;
