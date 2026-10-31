// ═══════════════════════════════════════════════════════
// MetroMatrix — Health home slice
// ═══════════════════════════════════════════════════════
// The home payload (specialties, common concerns, doctors free today, the
// next appointment, emergency numbers) for one city: the patient's default
// address city unless they pick another.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchHealthHome } from '../../networks/health/discovery';
import { toRejectedValue } from '../../networks/network/network';
import type { HealthHome } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { healthHomeSerializer } from '../../serializers/health/discoverySerializer';

export interface HealthHomeSliceState {
  home: HealthHome | null;
  /** A city the patient picked (null = the API's default for them). */
  city: string | null;
  cityPicker: boolean;
  status: FormStatus;
  refreshing: boolean;
  error: ServerError;
}

const initialState: HealthHomeSliceState = { home: null, city: null, cityPicker: false, status: 'idle', refreshing: false, error: NO_ERROR };

export const healthHomeSlice = createAppSlice({
  name: 'healthHome',
  initialState,
  reducers: create => ({
    setCityPicker: create.reducer((state, action: PayloadAction<boolean>) => {
      state.cityPicker = action.payload;
    }),
    loadHealthHomeAsync: create.asyncThunk(
      async ({ city }: { city: string | null; refresh?: boolean }, { rejectWithValue }) => {
        try {
          return await fetchHealthHome(city);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          if (action.meta.arg.refresh) state.refreshing = true;
          else state.status = 'loading';
          state.city = action.meta.arg.city;
          state.cityPicker = false;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = healthHomeSerializer(action.payload);
          state.home = payload;
          state.status = 'succeeded';
          state.refreshing = false;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.refreshing = false;
          state.error = readRejection(action, "Health didn't load. Check your connection and try again.");
        },
      },
    ),
  }),
  selectors: {
    selectHealthHome: state => state,
  },
});

export const { setCityPicker, loadHealthHomeAsync } = healthHomeSlice.actions;
export const { selectHealthHome } = healthHomeSlice.selectors;
