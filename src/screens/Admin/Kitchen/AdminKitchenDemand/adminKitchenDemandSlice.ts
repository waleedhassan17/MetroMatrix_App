// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: demand map slice
// ═══════════════════════════════════════════════════════
// A city's anonymous Food Court searches by area and hour, filtered by
// cuisine and time of day; the cuisines come from the console's list.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { getPlatformDemandAPI } from '@networks/admin/adminKitchenNetwork';
import { getAdminCuisinesAPI } from '@networks/admin/adminFoodNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { AdminCuisine, AdminDemandMap } from '@/types';
import {
  NO_ERROR,
  readRejection,
  type FormStatus,
  type ServerError,
} from '../../../Auth/shared/formStatus';
import { adminCuisinesSerializer } from '@serializers/food/adminFoodSerializer';
import { adminDemandSerializer } from '@serializers/kitchen/adminKitchenSerializer';

export interface DemandFilter {
  city: string;
  cuisine: string | null;
  hour: number | null;
}

export interface AdminKitchenDemandSliceState extends DemandFilter {
  data: AdminDemandMap | null;
  cuisines: AdminCuisine[];
  status: FormStatus;
  error: ServerError;
}

const initialState: AdminKitchenDemandSliceState = {
  city: 'Lahore',
  cuisine: null,
  hour: null,
  data: null,
  cuisines: [],
  status: 'idle',
  error: NO_ERROR,
};

export const adminKitchenDemandSlice = createAppSlice({
  name: 'adminKitchenDemand',
  initialState,
  reducers: create => ({
    setAdminDemandFilter: create.reducer((state, action: PayloadAction<Partial<DemandFilter>>) => {
      Object.assign(state, action.payload);
    }),

    loadAdminDemandAsync: create.asyncThunk(
      async (input: DemandFilter & { withCuisines: boolean }, { rejectWithValue }) => {
        try {
          const [data, cuisines] = await Promise.all([
            getPlatformDemandAPI({ city: input.city, cuisine: input.cuisine, hour: input.hour }).then(raw => required(adminDemandSerializer(raw))),
            input.withCuisines ? getAdminCuisinesAPI().then(raw => required(adminCuisinesSerializer(raw))) : Promise.resolve(null),
          ]);
          return { data, cuisines };
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
          state.data = action.payload.data;
          if (action.payload.cuisines) state.cuisines = action.payload.cuisines.filter(c => c.isActive);
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The demand map didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectAdminKitchenDemand: state => state,
  },
});

export const { setAdminDemandFilter, loadAdminDemandAsync } = adminKitchenDemandSlice.actions;
export const { selectAdminKitchenDemand } = adminKitchenDemandSlice.selectors;
