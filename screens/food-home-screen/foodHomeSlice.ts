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

import { createAppSlice } from '../../store/createAppSlice';
import { fetchFoodHome } from '../../networks/food/discovery';
import { fetchSurplusNearby } from '../../networks/food/surplus';
import { fetchTiffinPlansNear } from '../../networks/foodGrowth/tiffin';
import { fetchIftarNearby } from '../../networks/foodGrowth/ramadan';
import { fetchHealthyPicks } from '../../networks/myKitchen/nutrition';
import { toRejectedValue } from '../../networks/network/network';
import { currentPoint } from '../../services/location';
import { setFoodPoint } from '../../store/preferencesSlice';
import type { FoodHome, HealthyPick, IftarKitchen, SurplusCard, TiffinPlan } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { foodHomeSerializer } from '../../serializers/food/discoverySerializer';
import { surplusCardsSerializer } from '../../serializers/kitchen/surplusSerializer';
import { tiffinPlansSerializer } from '../../serializers/kitchen/growthSerializer';
import { iftarNearbySerializer } from '../../serializers/kitchen/reachSerializer';
import { healthyPicksSerializer } from '../../serializers/myKitchen/myKitchenSerializer';

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
            fetchFoodHome(lat, lng),
            fetchSurplusNearby({ lat, lng }).catch(() => null),
            fetchTiffinPlansNear({ lat, lng }).catch(() => null),
            fetchIftarNearby({ lat, lng }).catch(() => null),
            fetchHealthyPicks({ lat, lng }).catch(() => null),
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
          const { home, surplus, tiffins, iftar, healthy } = action.payload;
          const iftarNearby = iftar === null ? null : iftarNearbySerializer(iftar);
          state.home = foodHomeSerializer(home);
          state.surplus = surplus === null ? [] : surplusCardsSerializer(surplus);
          state.tiffins = tiffins === null ? [] : tiffinPlansSerializer(tiffins);
          state.iftar = iftarNearby?.state === 'active' ? iftarNearby.items : [];
          state.healthy = healthy === null ? [] : healthyPicksSerializer(healthy);
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
