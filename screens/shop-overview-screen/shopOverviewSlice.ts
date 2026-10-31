// MetroMatrix — Admin Shopping overview slice.

import { createAppSlice } from '../../store/createAppSlice';
import { fetchAdminOrders, fetchReports } from '../../networks/admin/adminShop';
import { fetchProducts, fetchStores } from '../../networks/shopping/catalog';
import { toRejectedValue } from '../../networks/network/network';
import type { ShopOverview } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { shopOverviewSerializer } from '../../serializers/shopping/adminShopSerializer';

export interface ShopOverviewSliceState {
  overview: ShopOverview | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: ShopOverviewSliceState = { overview: null, status: 'idle', error: NO_ERROR };

export const shopOverviewSlice = createAppSlice({
  name: 'shopOverview',
  initialState,
  reducers: create => ({
    loadShopOverviewAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          // The API has no overview for staff: each number is a list's total.
          const [stores, products, orders, reports] = await Promise.all([
            fetchStores({}, 1, 1),
            fetchProducts({}, 1, 1),
            fetchAdminOrders({}, 1, 1),
            fetchReports('open', 1, 1),
          ]);
          return { stores, products, orders, reports };
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
          const payload = shopOverviewSerializer(action.payload);
          state.status = 'succeeded';
          state.overview = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't load the overview.");
        },
      },
    ),
  }),
  selectors: {
    selectShopOverview: state => state,
  },
});

export const { loadShopOverviewAsync } = shopOverviewSlice.actions;
export const { selectShopOverview } = shopOverviewSlice.selectors;
