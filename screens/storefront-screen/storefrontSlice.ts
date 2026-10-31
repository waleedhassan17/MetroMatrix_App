// MetroMatrix — Kitchen growth: the storefront. The kitchen's own link and
// QR code, and this month's orders by where they came from.

import { createAppSlice } from '../../store/createAppSlice';
import { getStorefrontAPI } from '../../networks/foodGrowth/storefrontNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import type { Storefront } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { storefrontSerializer } from '../../serializers/kitchen/reachSerializer';

export interface StorefrontSliceState {
  data: Storefront | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: StorefrontSliceState = { data: null, status: 'idle', error: NO_ERROR };

export const storefrontSlice = createAppSlice({
  name: 'storefront',
  initialState,
  reducers: create => ({
    loadStorefrontAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(storefrontSerializer(await getStorefrontAPI()));
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
          state.data = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your link didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectStorefront: state => state,
  },
});

export const { loadStorefrontAsync } = storefrontSlice.actions;
export const { selectStorefront } = storefrontSlice.selectors;
