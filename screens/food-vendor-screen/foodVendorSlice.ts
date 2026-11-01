// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: a vendor's page
// ═══════════════════════════════════════════════════════
// The page for the customer's point (fee, ETA, zone), cached by slug so
// going back and forth doesn't reload it.

import { createAppSlice } from '../../store/createAppSlice';
import { fetchVendorPage } from '../../networks/food/discovery';
import { fetchTiffinPlans } from '../../networks/foodGrowth/tiffin';
import { fetchCateringVendor } from '../../networks/foodGrowth/catering';
import { toRejectedValue } from '../../networks/network/network';
import type { VendorPage } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { vendorPageWithKitchenSerializer } from '../../serializers/kitchen/growthSerializer';

export interface VendorPageEntry {
  page: VendorPage | null;
  status: FormStatus;
  error: ServerError;
}

export interface FoodVendorSliceState {
  bySlug: Record<string, VendorPageEntry>;
}

const initialState: FoodVendorSliceState = { bySlug: {} };
const EMPTY: VendorPageEntry = { page: null, status: 'idle', error: NO_ERROR };

export const foodVendorSlice = createAppSlice({
  name: 'foodVendor',
  initialState,
  reducers: create => ({
    loadVendorPageAsync: create.asyncThunk(
      async ({ slug, at }: { slug: string; at: { lat: number; lng: number } | null }, { rejectWithValue }) => {
        try {
          // The page, and Kitchen Intelligence's own reads beside it (a kitchen without them is the same page).
          const [page, tiffinPlans, catering] = await Promise.all([fetchVendorPage(slug, at), fetchTiffinPlans(slug).catch(() => null), fetchCateringVendor(slug).catch(() => null)]);
          return { page, tiffinPlans, catering };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const e = (state.bySlug[action.meta.arg.slug] ??= { ...EMPTY });
          e.status = 'loading';
          e.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = vendorPageWithKitchenSerializer(action.payload);
          state.bySlug[action.meta.arg.slug] = { page: payload, status: 'succeeded', error: NO_ERROR };
        },
        rejected: (state, action) => {
          const e = (state.bySlug[action.meta.arg.slug] ??= { ...EMPTY });
          e.status = 'failed';
          e.error = readRejection(action, "This kitchen's page didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorPage: (state, slug: string): VendorPageEntry => state.bySlug[slug] ?? EMPTY,
  },
});

export const { loadVendorPageAsync } = foodVendorSlice.actions;
export const { selectVendorPage } = foodVendorSlice.selectors;
