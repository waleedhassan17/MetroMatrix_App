// MetroMatrix — Admin Shopping overview slice.

import { createAppSlice } from '@store/createAppSlice';
import { getShopOverview } from '@networks/admin/adminShopNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { ShopOverview } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

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
          return await getShopOverview();
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
          state.overview = action.payload;
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
