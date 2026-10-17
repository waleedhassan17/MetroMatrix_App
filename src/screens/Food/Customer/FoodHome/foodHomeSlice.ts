// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court home (the Food app's Home tab)
// ═══════════════════════════════════════════════════════
// The home for the customer's delivery point: cuisines and the rails (deals,
// top rated, fastest, home kitchens…), or "not delivering here yet" with the
// pick-up places nearby. The point itself is a device preference
// (preferences.foodPoint); the list under the rails is paged by the screen.

import { createAppSlice } from '@store/createAppSlice';
import { getFoodHome } from '@networks/food/discoveryNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { currentPoint } from '../../../../services/location';
import { setFoodPoint } from '@store/preferencesSlice';
import type { FoodHome } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export interface FoodHomeSliceState {
  home: FoodHome | null;
  /** "lat,lng" the home was built for. */
  builtFor: string | null;
  status: FormStatus;
  refreshing: boolean;
  error: ServerError;
  pointSheet: boolean;
  locating: boolean;
  locateError: string;
}

const initialState: FoodHomeSliceState = {
  home: null,
  builtFor: null,
  status: 'idle',
  refreshing: false,
  error: NO_ERROR,
  pointSheet: false,
  locating: false,
  locateError: '',
};

export const pointKey = (p: { lat: number; lng: number }) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

export const foodHomeSlice = createAppSlice({
  name: 'foodHome',
  initialState,
  reducers: create => ({
    openPointSheet: create.reducer(state => {
      state.pointSheet = true;
      state.locateError = '';
    }),
    closePointSheet: create.reducer(state => {
      state.pointSheet = false;
    }),
    loadFoodHomeAsync: create.asyncThunk(
      async ({ lat, lng }: { lat: number; lng: number; refresh?: boolean }, { rejectWithValue }) => {
        try {
          return await getFoodHome(lat, lng);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const key = pointKey(action.meta.arg);
          if (action.meta.arg.refresh) state.refreshing = true;
          else {
            state.status = 'loading';
            if (state.builtFor !== key) state.home = null;
          }
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.refreshing = false;
          state.home = action.payload;
          state.builtFor = pointKey(action.meta.arg);
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.refreshing = false;
          state.error = readRejection(action, "The Food Court didn't load.");
        },
      },
    ),
    /** "Use my current location": asks once, then delivers there. */
    locateMeAsync: create.asyncThunk(
      async (_: void, { dispatch, rejectWithValue }) => {
        const at = await currentPoint();
        if (!at) return rejectWithValue({ message: 'Location is off. Pick a saved address, or allow location for MetroMatrix.', code: null, details: null });
        dispatch(setFoodPoint({ ...at, label: 'Current location', addressId: null }));
        return at;
      },
      {
        pending: state => {
          state.locating = true;
          state.locateError = '';
        },
        fulfilled: state => {
          state.locating = false;
          state.pointSheet = false;
        },
        rejected: (state, action) => {
          state.locating = false;
          state.locateError = readRejection(action, 'Location is off.').message;
        },
      },
    ),
  }),
  selectors: {
    selectFoodHome: state => state,
  },
});

export const { openPointSheet, closePointSheet, loadFoodHomeAsync, locateMeAsync } = foodHomeSlice.actions;
export const { selectFoodHome } = foodHomeSlice.selectors;
