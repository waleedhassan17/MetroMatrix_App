// ═══════════════════════════════════════════════════════
// MetroMatrix — Bag slice (the customer's shopping bag)
// ═══════════════════════════════════════════════════════
// The server owns the Bag: prices, stock warnings and totals are always its
// answer (every change returns the whole recomputed Bag). Read by the Bag
// screen, the header count on every Shopping screen, and "Add to bag".

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { acknowledgeCart, addToCart, fetchCart, removeCartLine, updateCartLine } from '../../networks/shopping/cart';
import { toRejectedValue, required } from '../../networks/network/network';
import { EMPTY_CART, cartSerializer } from '../../serializers/shopping/cartSerializer';
import type { Cart } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';

export interface BagSliceState {
  cart: Cart;
  status: FormStatus;
  refreshing: boolean;
  error: ServerError;
  /** The line a quantity change or removal is in flight for. */
  busyLineId: string | null;
  adding: boolean;
  addError: ServerError;
  /** The last action's failure (a quantity the store can't fill …). */
  actionError: ServerError;
}

const initialState: BagSliceState = {
  cart: EMPTY_CART,
  status: 'idle',
  refreshing: false,
  error: NO_ERROR,
  busyLineId: null,
  adding: false,
  addError: NO_ERROR,
  actionError: NO_ERROR,
};

export const bagSlice = createAppSlice({
  name: 'bag',
  initialState,
  reducers: create => ({
    clearBagErrors: create.reducer(state => {
      state.addError = NO_ERROR;
      state.actionError = NO_ERROR;
    }),
    /** Checkout placed an order: the server has emptied those lines. */
    setCart: create.reducer((state, action: PayloadAction<Cart>) => {
      state.cart = action.payload;
    }),

    loadBagAsync: create.asyncThunk(
      async (_: { refresh: boolean } | undefined, { rejectWithValue }) => {
        try {
          return await fetchCart();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.status = 'loading';
          state.refreshing = !!action.meta.arg?.refresh;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = cartSerializer(action.payload);
          state.status = 'succeeded';
          state.refreshing = false;
          state.cart = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.refreshing = false;
          state.error = readRejection(action, "We couldn't load your bag.");
        },
      },
    ),

    addToBagAsync: create.asyncThunk(
      async ({ variantId, quantity }: { variantId: string; quantity: number }, { rejectWithValue }) => {
        try {
          return await addToCart(variantId, quantity);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.adding = true;
          state.addError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = cartSerializer(action.payload);
          state.adding = false;
          state.cart = payload;
          state.status = 'succeeded';
        },
        rejected: (state, action) => {
          state.adding = false;
          state.addError = readRejection(action, "We couldn't add this to your bag.");
        },
      },
    ),

    updateLineAsync: create.asyncThunk(
      async ({ lineId, quantity }: { lineId: string; quantity: number }, { rejectWithValue }) => {
        try {
          return await updateCartLine(lineId, quantity);
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
          const payload = cartSerializer(action.payload);
          state.busyLineId = null;
          state.cart = payload;
        },
        rejected: (state, action) => {
          state.busyLineId = null;
          state.actionError = readRejection(action, "We couldn't change the quantity.");
        },
      },
    ),

    removeLineAsync: create.asyncThunk(
      async (lineId: string, { rejectWithValue }) => {
        try {
          return await removeCartLine(lineId);
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
          const payload = cartSerializer(action.payload);
          state.busyLineId = null;
          state.cart = payload;
        },
        rejected: (state, action) => {
          state.busyLineId = null;
          state.actionError = readRejection(action, "We couldn't remove that item.");
        },
      },
    ),

    acknowledgeBagAsync: create.asyncThunk(
      async (lineIds: string[], { rejectWithValue }) => {
        try {
          return await acknowledgeCart(lineIds);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          const payload = cartSerializer(action.payload);
          state.cart = payload;
        },
        rejected: (state, action) => {
          state.actionError = readRejection(action, "We couldn't update your bag.");
        },
      },
    ),
  }),
  selectors: {
    selectBag: state => state,
    selectBagCount: state => state.cart.itemCount,
  },
});

export const { clearBagErrors, setCart, loadBagAsync, addToBagAsync, updateLineAsync, removeLineAsync, acknowledgeBagAsync } =
  bagSlice.actions;
export const { selectBag, selectBagCount } = bagSlice.selectors;
