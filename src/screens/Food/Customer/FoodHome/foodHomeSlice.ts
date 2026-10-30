// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court home (the Food app's Home tab)
// ═══════════════════════════════════════════════════════
// The home for the customer's delivery point: cuisines and the rails (deals,
// top rated, fastest, home kitchens…), or "not delivering here yet" with the
// pick-up places nearby. The point itself is a device preference
// (preferences.foodPoint); the list under the rails is paged by the screen.
// Bachat Boxes nearby (tonight's surplus, for pickup), home-cooked tiffin
// plans and, in Ramadan, kitchens keeping iftar hours ride along; without
// them the home is the same (TODO(API_KITCHEN)).

import { createAppSlice } from '@store/createAppSlice';
import { getFoodHomeAPI } from '@networks/food/discoveryNetwork';
import { getSurplusNearbyAPI } from '@networks/food/surplusNetwork';
import { listTiffinPlansNear } from '@networks/foodGrowth/tiffinNetwork';
import { listIftarNearby } from '@networks/foodGrowth/ramadanNetwork';
import { listHealthyPicks } from '@networks/myKitchen/nutritionNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import { currentPoint } from '../../../../services/location';
import { setFoodPoint } from '@store/preferencesSlice';
import type { FoodHome, HealthyPick, IftarKitchen, SurplusCard, TiffinPlan } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { foodHomeSerializer } from '@serializers/food/discoverySerializer';
import { surplusCardsSerializer } from '@serializers/kitchen/surplusSerializer';

export interface FoodHomeSliceState {
  home: FoodHome | null;
  surplus: SurplusCard[];
  tiffins: TiffinPlan[];
  /** Kitchens keeping iftar hours nearby (in Ramadan only). */
  iftar: IftarKitchen[];
  /** Meals under 600 kcal or high in protein (shown only to people who turned calories on). */
  healthy: HealthyPick[];
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
  surplus: [],
  tiffins: [],
  iftar: [],
  healthy: [],
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
          // The extras never hold the home back: a failure is an empty rail.
          const [home, surplus, tiffins, iftar, healthy] = await Promise.all([
            getFoodHomeAPI(lat, lng).then(raw => required(foodHomeSerializer(raw))),
            getSurplusNearbyAPI({ lat, lng }).then(raw => required(surplusCardsSerializer(raw))).catch(() => [] as SurplusCard[]),
            listTiffinPlansNear({ lat, lng }).catch(() => [] as TiffinPlan[]),
            listIftarNearby({ lat, lng })
              .then(r => (r.state === 'active' ? r.items : []))
              .catch(() => [] as IftarKitchen[]),
            listHealthyPicks({ lat, lng }).catch(() => [] as HealthyPick[]),
          ]);
          return { home, surplus, tiffins, iftar, healthy };
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
          state.home = action.payload.home;
          state.surplus = action.payload.surplus;
          state.tiffins = action.payload.tiffins;
          state.iftar = action.payload.iftar;
          state.healthy = action.payload.healthy;
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
