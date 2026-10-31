// MetroMatrix — Food Court: a kitchen's public page (its own link or QR),
// read without signing in.

import { createAppSlice } from '../../store/createAppSlice';
import { fetchVendorPage } from '../../networks/food/discovery';
import { toRejectedValue, required } from '../../networks/network/network';
import type { VendorPage } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { vendorPageSerializer } from '../../serializers/food/discoverySerializer';

export interface PublicStoreSliceState {
  slug: string | null;
  page: VendorPage | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: PublicStoreSliceState = { slug: null, page: null, status: 'idle', error: NO_ERROR };

export const publicStoreSlice = createAppSlice({
  name: 'publicStore',
  initialState,
  reducers: create => ({
    loadPublicStoreAsync: create.asyncThunk(
      async (slug: string, { rejectWithValue }) => {
        try {
          return await fetchVendorPage(slug, null);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.status = 'loading';
          state.error = NO_ERROR;
          if (state.slug !== action.meta.arg) state.page = null;
          state.slug = action.meta.arg;
        },
        fulfilled: (state, action) => {
          const payload = vendorPageSerializer(action.payload);
          state.status = 'succeeded';
          state.page = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "This kitchen's page didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectPublicStore: state => state,
  },
});

export const { loadPublicStoreAsync } = publicStoreSlice.actions;
export const { selectPublicStore } = publicStoreSlice.selectors;
