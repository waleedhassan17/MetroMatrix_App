// MetroMatrix — Kitchen growth: demand nearby. Anonymous searches around the
// kitchen by area and hour, filtered by cuisine and time of day.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { getDemand } from '@networks/foodGrowth/demandNetwork';
import { getCuisines } from '@networks/food/vendor/profileNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { DemandMap, FoodCuisine } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export interface DemandMapSliceState {
  cuisine: string | null;
  hour: number | null;
  data: DemandMap | null;
  cuisines: FoodCuisine[];
  status: FormStatus;
  error: ServerError;
}

const initialState: DemandMapSliceState = { cuisine: null, hour: null, data: null, cuisines: [], status: 'idle', error: NO_ERROR };

export const demandMapSlice = createAppSlice({
  name: 'demandMap',
  initialState,
  reducers: create => ({
    setDemandFilter: create.reducer((state, action: PayloadAction<{ cuisine?: string | null; hour?: number | null }>) => {
      if (action.payload.cuisine !== undefined) state.cuisine = action.payload.cuisine;
      if (action.payload.hour !== undefined) state.hour = action.payload.hour;
    }),
    loadDemandAsync: create.asyncThunk(
      async (filter: { cuisine: string | null; hour: number | null; withCuisines?: boolean }, { rejectWithValue }) => {
        try {
          const [data, cuisines] = await Promise.all([getDemand(filter), filter.withCuisines ? getCuisines() : Promise.resolve(null)]);
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
          if (action.payload.cuisines) state.cuisines = action.payload.cuisines;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The demand map didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectDemandMap: state => state,
  },
});

export const { setDemandFilter, loadDemandAsync } = demandMapSlice.actions;
export const { selectDemandMap } = demandMapSlice.selectors;
