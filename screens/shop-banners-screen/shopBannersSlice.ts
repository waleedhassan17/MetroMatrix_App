// MetroMatrix — Admin banners slice: the Shopping home's carousel, in order.
// The stores and categories come along to name what each banner leads to.

import { createAppSlice } from '../../store/createAppSlice';
import { fetchAdminBanners, fetchAdminCategories, updateBanner } from '../../networks/admin/adminShop';
import { fetchStores } from '../../networks/shopping/catalog';
import { toRejectedValue } from '../../networks/network/network';
import type { AdminBanner } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { adminBannerListSerializer } from '../../serializers/shopping/adminShopSerializer';
import { categoryListSerializer, storeSummaryPageSerializer } from '../../serializers/shopping/catalogSerializer';

export interface ShopBannersSliceState {
  banners: AdminBanner[];
  status: FormStatus;
  busy: boolean;
  error: ServerError;
}

const initialState: ShopBannersSliceState = { banners: [], status: 'idle', busy: false, error: NO_ERROR };

const loadAll = async () => {
  const [banners, stores, categories] = await Promise.all([fetchAdminBanners(), fetchStores({}, 1, 100), fetchAdminCategories()]);
  return { banners, stores, categories };
};

const bannersOf = (p: { banners: unknown; stores: unknown; categories: unknown }) =>
  adminBannerListSerializer(p.banners, { stores: storeSummaryPageSerializer(p.stores).items, categories: categoryListSerializer(p.categories) });

const input = (b: AdminBanner) => ({
  imageUrl: b.imageUrl,
  headline: b.headline,
  subhead: b.subhead,
  target: b.target,
  startsAt: b.startsAt,
  endsAt: b.endsAt,
  position: b.position,
  isActive: b.isActive,
});

export const shopBannersSlice = createAppSlice({
  name: 'shopBanners',
  initialState,
  reducers: create => ({
    loadBannersAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await loadAll();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
        },
        fulfilled: (state, action) => {
          const payload = bannersOf(action.payload);
          state.status = 'succeeded';
          state.banners = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't load the banners.");
        },
      },
    ),
    /** Swap two banners' positions, or switch one on / off. */
    changeBannersAsync: create.asyncThunk(
      async (change: { kind: 'swap'; a: AdminBanner; b: AdminBanner } | { kind: 'toggle'; banner: AdminBanner }, { rejectWithValue }) => {
        try {
          if (change.kind === 'swap') {
            await updateBanner(change.a.id, { ...input(change.a), position: change.b.position });
            await updateBanner(change.b.id, { ...input(change.b), position: change.a.position });
          } else await updateBanner(change.banner.id, { ...input(change.banner), isActive: !change.banner.isActive });
          return await loadAll();
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
          const payload = bannersOf(action.payload);
          state.busy = false;
          state.banners = payload;
        },
        rejected: (state, action) => {
          state.busy = false;
          state.error = readRejection(action, "That didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectShopBanners: state => state,
  },
});

export const { loadBannersAsync, changeBannersAsync } = shopBannersSlice.actions;
export const { selectShopBanners } = shopBannersSlice.selectors;
