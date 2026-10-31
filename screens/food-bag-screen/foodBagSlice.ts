// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: the bag
// ═══════════════════════════════════════════════════════
// One vendor's dishes. The server owns it: every change answers with the
// whole bag re-priced, with what has changed said on the line. Adding a
// dish from another vendor asks first ("Start a new bag?"), then replaces.
// Read by the bag screen, the vendor page's bag bar and checkout.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import {
  addToFoodCart,
  clearFoodCart,
  fetchFoodCart,
  fetchVendorSlots,
  removeFoodCartLine,
  setFoodCartMode,
  updateFoodCartLine,
} from '../../networks/food/cart';
import { reorderFood } from '../../networks/food/orders';
import { toRejectedValue, required } from '../../networks/network/network';
import { EMPTY_FOOD_CART, foodCartSerializer, foodSlotsSerializer, reorderSerializer } from '../../serializers/food/orderSerializer';
import type { FoodCart, FoodFulfilment, FoodSlots } from '../../models';
import {
  NO_ERROR,
  readRejection,
  type FormStatus,
  type ServerError,
} from '../shared/formStatus';

export type FoodLineInput = Parameters<typeof addToFoodCart>[0];

export interface FoodBagSliceState {
  cart: FoodCart;
  status: FormStatus;
  error: ServerError;
  adding: boolean;
  addError: ServerError;
  /** Another vendor's dishes are in the bag: the dish waiting for "Start a new bag". */
  otherVendor: { name: string; itemCount: number; input: FoodLineInput } | null;
  /** The line a change is in flight for. */
  busyLineId: string | null;
  /** Delivery / pick-up or the time is being changed. */
  modeBusy: boolean;
  actionError: ServerError;
  /** The vendor's pre-order slots, for "Schedule". */
  slots: FoodSlots | null;
  slotsFor: string | null;
  whenSheetOpen: boolean;
}

const initialState: FoodBagSliceState = {
  cart: EMPTY_FOOD_CART,
  status: 'idle',
  error: NO_ERROR,
  adding: false,
  addError: NO_ERROR,
  otherVendor: null,
  busyLineId: null,
  modeBusy: false,
  actionError: NO_ERROR,
  slots: null,
  slotsFor: null,
  whenSheetOpen: false,
};

export const foodBagSlice = createAppSlice({
  name: 'foodBag',
  initialState,
  reducers: create => ({
    /** Checkout placed the order (the server emptied the bag), or a reorder filled it. */
    setFoodBag: create.reducer((state, action: PayloadAction<FoodCart>) => {
      state.cart = action.payload;
      state.status = 'succeeded';
    }),
    dismissOtherVendor: create.reducer(state => {
      state.otherVendor = null;
    }),
    clearFoodBagErrors: create.reducer(state => {
      state.addError = NO_ERROR;
      state.actionError = NO_ERROR;
    }),
    setWhenSheet: create.reducer((state, action: PayloadAction<boolean>) => {
      state.whenSheetOpen = action.payload;
    }),

    loadFoodBagAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(foodCartSerializer(await fetchFoodCart()));
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
          state.cart = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't load your bag.");
        },
      },
    ),

    addToFoodBagAsync: create.asyncThunk(
      async (
        { input, replace }: { input: FoodLineInput; replace: boolean },
        { rejectWithValue },
      ) => {
        try {
          return required(foodCartSerializer(await addToFoodCart(input, replace)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.adding = true;
          state.addError = NO_ERROR;
          state.otherVendor = null;
        },
        fulfilled: (state, action) => {
          state.adding = false;
          state.status = 'succeeded';
          state.cart = action.payload;
        },
        rejected: (state, action) => {
          state.adding = false;
          const err = readRejection(action, "We couldn't add this to your bag.");
          const d = err.details as { currentVendor?: { name?: string }; itemCount?: number } | null;
          if (err.code === 'CART_OTHER_VENDOR') {
            state.otherVendor = {
              name: d?.currentVendor?.name ?? 'another kitchen',
              itemCount: d?.itemCount ?? 0,
              input: action.meta.arg.input,
            };
          } else state.addError = err;
        },
      },
    ),

    updateFoodLineAsync: create.asyncThunk(
      async ({ lineId, quantity }: { lineId: string; quantity: number }, { rejectWithValue }) => {
        try {
          return required(foodCartSerializer(await updateFoodCartLine(lineId, { quantity })));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busyLineId = action.meta.arg.lineId;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busyLineId = null;
          state.cart = action.payload;
        },
        rejected: (state, action) => {
          state.busyLineId = null;
          state.actionError = readRejection(action, "We couldn't change that.");
        },
      },
    ),

    removeFoodLineAsync: create.asyncThunk(
      async (lineId: string, { rejectWithValue }) => {
        try {
          return required(foodCartSerializer(await removeFoodCartLine(lineId)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busyLineId = action.meta.arg;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busyLineId = null;
          state.cart = action.payload;
        },
        rejected: (state, action) => {
          state.busyLineId = null;
          state.actionError = readRejection(action, "We couldn't remove that.");
        },
      },
    ),

    setFoodBagModeAsync: create.asyncThunk(
      async (
        input: { fulfilment?: FoodFulfilment; scheduledFor?: string | null },
        { rejectWithValue },
      ) => {
        try {
          return required(foodCartSerializer(await setFoodCartMode(input)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.modeBusy = true;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.modeBusy = false;
          state.cart = action.payload;
          state.whenSheetOpen = false;
        },
        rejected: (state, action) => {
          state.modeBusy = false;
          state.actionError = readRejection(action, "We couldn't change that.");
          // A refused time isn't kept.
          if (action.meta.arg.scheduledFor) state.cart.scheduledFor = null;
        },
      },
    ),

    clearFoodBagAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await clearFoodCart();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: state => {
          state.cart = EMPTY_FOOD_CART;
        },
        rejected: (state, action) => {
          state.actionError = readRejection(action, "We couldn't empty your bag.");
        },
      },
    ),

    loadFoodSlotsAsync: create.asyncThunk(
      async (vendor: string, { rejectWithValue }) => {
        try {
          return required(foodSlotsSerializer(await fetchVendorSlots(vendor)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          if (state.slotsFor !== action.meta.arg) state.slots = null;
          state.slotsFor = action.meta.arg;
        },
        fulfilled: (state, action) => {
          if (state.slotsFor === action.meta.arg) state.slots = action.payload;
        },
      },
    ),

    /** A past order back in the bag at today's prices; says how many dishes couldn't come. */
    reorderFoodAsync: create.asyncThunk(
      async (code: string, { rejectWithValue }) => {
        try {
          return required(reorderSerializer(await reorderFood(code)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.cart = action.payload.cart;
          state.status = 'succeeded';
        },
        rejected: (state, action) => {
          state.actionError = readRejection(action, "We couldn't add those dishes again.");
        },
      },
    ),
  }),
  selectors: {
    selectFoodBag: state => state,
    selectFoodBagCount: state => state.cart.itemCount,
  },
});

export const {
  setFoodBag,
  dismissOtherVendor,
  clearFoodBagErrors,
  setWhenSheet,
  loadFoodBagAsync,
  addToFoodBagAsync,
  updateFoodLineAsync,
  removeFoodLineAsync,
  setFoodBagModeAsync,
  clearFoodBagAsync,
  loadFoodSlotsAsync,
  reorderFoodAsync,
} = foodBagSlice.actions;
export const { selectFoodBag, selectFoodBagCount } = foodBagSlice.selectors;
