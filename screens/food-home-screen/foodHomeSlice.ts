// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court home (the Food app's Home tab)
// ═══════════════════════════════════════════════════════
// The home for the customer's delivery point: cuisines and the rails (deals,
// top rated, fastest, home kitchens…), or "not delivering here yet" with the
// pick-up places nearby. The point itself is a device preference
// (preferences.foodPoint); the list under the rails is paged by the screen.
// Bachat Boxes nearby (tonight's surplus, for pickup) and, for people who
// turned calories on, kitchens with lighter dishes ride along; without them
// the home is the same. Tiffin and iftar kitchens are the home's own rails.
// The customer's orders still on their way head the page (activeOrders).

import { createAppSlice } from '../../store/createAppSlice';
import { fetchFoodHome } from '../../networks/food/discovery';
import { fetchSurplusNearby } from '../../networks/food/surplus';
import { fetchFoodOrders } from '../../networks/food/orders';
import { fetchHealthyPicks } from '../../networks/myKitchen/nutrition';
import { toRejectedValue } from '../../networks/network/network';
import { currentPoint } from '../../services/location';
import { setFoodPoint } from '../../store/preferencesSlice';
import type { FoodHome, FoodOrderSummary, SurplusCard, VendorCard } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { foodHomeSerializer, vendorCardsPageSerializer } from '../../serializers/food/discoverySerializer';
import { surplusCardsSerializer } from '../../serializers/kitchen/surplusSerializer';
import { foodOrdersPageSerializer } from '../../serializers/food/orderSerializer';

export interface FoodHomeSliceState {
  home: FoodHome | null;
  surplus: SurplusCard[];
  /** Kitchens with dishes under 600 kcal (shown only to people who turned calories on). */
  healthy: VendorCard[];
  /** "lat,lng" the home was built for. */
  builtFor: string | null;
  status: FormStatus;
  refreshing: boolean;
  error: ServerError;
  pointSheet: boolean;
  locating: boolean;
  locateError: string;
  /** Orders on their way (the first few), for the live-order card. */
  activeOrders: FoodOrderSummary[];
  activeTotal: number;
}

const initialState: FoodHomeSliceState = {
  home: null,
  surplus: [],
  healthy: [],
  builtFor: null,
  status: 'idle',
  refreshing: false,
  error: NO_ERROR,
  pointSheet: false,
  locating: false,
  locateError: '',
  activeOrders: [],
  activeTotal: 0,
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
          const [home, surplus, healthy] = await Promise.all([
            fetchFoodHome(lat, lng),
            fetchSurplusNearby({ lat, lng }).catch(() => null),
            fetchHealthyPicks({ lat, lng }).catch(() => null),
          ]);
          return { home, surplus, healthy };
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
          const { home, surplus, healthy } = action.payload;
          state.home = foodHomeSerializer(home);
          state.surplus = surplus === null ? [] : surplusCardsSerializer(surplus);
          state.healthy = healthy === null ? [] : vendorCardsPageSerializer(healthy).items.slice(0, 10);
          state.builtFor = pointKey(action.meta.arg);
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.refreshing = false;
          state.error = readRejection(action, "The Food Court didn't load.");
        },
      },
    ),
    /** The customer's orders on their way; a failure leaves the card out. */
    loadActiveFoodOrdersAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await fetchFoodOrders('active', 1, 3);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          const page = foodOrdersPageSerializer(action.payload);
          state.activeOrders = page.items;
          state.activeTotal = page.total;
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

export const { openPointSheet, closePointSheet, loadFoodHomeAsync, loadActiveFoodOrdersAsync, locateMeAsync } = foodHomeSlice.actions;
export const { selectFoodHome } = foodHomeSlice.selectors;
