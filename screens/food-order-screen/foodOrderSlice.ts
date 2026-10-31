// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: one order, live
// ═══════════════════════════════════════════════════════
// The order (lines, money, payment, what the customer may do) and, while it
// is on its way, its tracking (the kitchen and drop-off pins, the rider, the
// minutes left). Kept per code, so going back and forth doesn't flash. The
// live channel hands over new states (`foodOrderChanged`) and the rider's
// fixes (`foodRiderMoved`); REST is read again after reconnects.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { cancelFoodOrderAPI, getFoodOrderAPI, getFoodTrackingAPI } from '../../networks/food/ordersNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import { isEnded } from '../../models/food/foodStatusModel';
import type { FoodOrder, FoodRiderFix, FoodTracking } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { foodOrderSerializer, foodTrackingSerializer } from '../../serializers/food/orderSerializer';

export interface FoodOrderEntry {
  order: FoodOrder | null;
  tracking: FoodTracking | null;
  status: FormStatus;
  error: ServerError;
}

export interface FoodOrderSliceState {
  byCode: Record<string, FoodOrderEntry>;
  cancelling: boolean;
  cancelError: ServerError;
  cancelSheetOpen: boolean;
}

const EMPTY: FoodOrderEntry = { order: null, tracking: null, status: 'idle', error: NO_ERROR };
const initialState: FoodOrderSliceState = { byCode: {}, cancelling: false, cancelError: NO_ERROR, cancelSheetOpen: false };

const entry = (state: FoodOrderSliceState, code: string) => (state.byCode[code] ??= { ...EMPTY });

export const foodOrderSlice = createAppSlice({
  name: 'foodOrder',
  initialState,
  reducers: create => ({
    /** The live channel's new state for an order. */
    foodOrderChanged: create.reducer((state, action: PayloadAction<FoodOrder>) => {
      const e = entry(state, action.payload.code);
      e.order = action.payload;
      if (e.tracking) {
        e.tracking.status = action.payload.status;
        e.tracking.statusLabel = action.payload.statusLabel;
        e.tracking.rider = action.payload.rider ?? e.tracking.rider;
        e.tracking.handedToExternal = action.payload.handedToExternal;
      }
    }),
    /** The rider's latest fix. */
    foodRiderMoved: create.reducer((state, action: PayloadAction<{ code: string; fix: FoodRiderFix }>) => {
      const e = state.byCode[action.payload.code];
      const { fix } = action.payload;
      for (const r of [e?.tracking?.rider, e?.order?.rider]) {
        if (!r) continue;
        r.lastPosition = { lat: fix.lat, lng: fix.lng };
        r.locationLive = true;
        r.at = fix.at || r.at;
      }
    }),
    setCancelSheet: create.reducer((state, action: PayloadAction<boolean>) => {
      state.cancelSheetOpen = action.payload;
      state.cancelError = NO_ERROR;
    }),

    loadFoodOrderAsync: create.asyncThunk(
      async (code: string, { rejectWithValue }) => {
        try {
          const order = required(foodOrderSerializer(await getFoodOrderAPI(code)));
          // Tracking only matters while it's on its way.
          const tracking = isEnded(order.status) ? null : required(foodTrackingSerializer(await getFoodTrackingAPI(code)));
          return { order, tracking };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const e = entry(state, action.meta.arg);
          e.status = 'loading';
          e.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const e = entry(state, action.meta.arg);
          e.status = 'succeeded';
          e.order = action.payload.order;
          e.tracking = action.payload.tracking;
        },
        rejected: (state, action) => {
          const e = entry(state, action.meta.arg);
          e.status = 'failed';
          e.error = readRejection(action, "This order didn't load.");
        },
      },
    ),

    cancelFoodOrderAsync: create.asyncThunk(
      async ({ code, reason }: { code: string; reason: string | null }, { rejectWithValue }) => {
        try {
          return required(foodOrderSerializer(await cancelFoodOrderAPI(code, reason)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.cancelling = true;
          state.cancelError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.cancelling = false;
          state.cancelSheetOpen = false;
          const e = entry(state, action.payload.code);
          e.order = action.payload;
          e.tracking = null;
        },
        rejected: (state, action) => {
          state.cancelling = false;
          state.cancelError = readRejection(action, "We couldn't cancel this order.");
        },
      },
    ),
  }),
  selectors: {
    selectFoodOrderEntry: (state, code: string): FoodOrderEntry => state.byCode[code] ?? EMPTY,
    selectFoodOrderUi: state => state,
  },
});

export const { foodOrderChanged, foodRiderMoved, setCancelSheet, loadFoodOrderAsync, cancelFoodOrderAsync } = foodOrderSlice.actions;
export const { selectFoodOrderEntry, selectFoodOrderUi } = foodOrderSlice.selectors;
