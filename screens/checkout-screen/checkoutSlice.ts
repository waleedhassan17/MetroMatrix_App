// ═══════════════════════════════════════════════════════
// MetroMatrix — Checkout slice
// ═══════════════════════════════════════════════════════
// One screen, every store in the Bag: the delivery address, then per store
// the payment method, an optional coupon and a note. The server prices it
// all (preview) after each change settles, and says per store what stands
// in the way (a city it doesn't deliver to, a coupon that doesn't apply …).
//
// Placing is idempotent: the Idempotency-Key is made once (a prepared
// reducer — randomUUID is impure), kept across retries, and renewed only
// after an order is placed. A double tap or a lost response can never place
// two orders.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { newUuid } from '../../utils/ids/ids';
import { fetchAvailableCoupons, placeOrder, previewCheckout } from '../../networks/shopping/checkout';
import { toRejectedValue, required } from '../../networks/network/network';
import type { AvailableCoupon, CheckoutInput, CheckoutPreview, OrderGroup, PaymentMethod } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { checkoutPreviewSerializer, availableCouponListSerializer } from '../../serializers/shopping/cartSerializer';
import { orderGroupSerializer } from '../../serializers/shopping/orderSerializer';

export interface StoreCheckoutChoice {
  paymentMethod: PaymentMethod | null;
  couponCode: string | null;
  note: string;
}

export interface CheckoutSliceState {
  addressId: string | null;
  choices: Record<string, StoreCheckoutChoice>;
  preview: CheckoutPreview | null;
  previewStatus: FormStatus;
  previewError: ServerError;
  /** Sent with "Place order"; the same on a retry. */
  idempotencyKey: string;
  placeStatus: FormStatus;
  placeError: ServerError;
  placed: OrderGroup | null;
  couponSheet: { storeId: string | null; input: string; coupons: AvailableCoupon[]; status: FormStatus };
  addressSheetOpen: boolean;
}

const initialState: CheckoutSliceState = {
  addressId: null,
  choices: {},
  preview: null,
  previewStatus: 'idle',
  previewError: NO_ERROR,
  idempotencyKey: '',
  placeStatus: 'idle',
  placeError: NO_ERROR,
  placed: null,
  couponSheet: { storeId: null, input: '', coupons: [], status: 'idle' },
  addressSheetOpen: false,
};

const blankChoice = (): StoreCheckoutChoice => ({ paymentMethod: null, couponCode: null, note: '' });

/** The request for the stores in the Bag, from what the customer chose. */
export const toCheckoutInput = (addressId: string, storeIds: string[], choices: Record<string, StoreCheckoutChoice>): CheckoutInput => ({
  addressId,
  stores: storeIds.map(storeId => {
    const c = choices[storeId] ?? blankChoice();
    return {
      storeId,
      paymentMethod: c.paymentMethod ?? 'cod',
      couponCode: c.couponCode,
      note: c.note.trim() || null,
    };
  }),
});

export const checkoutSlice = createAppSlice({
  name: 'checkout',
  initialState,
  reducers: create => ({
    /** A fresh key — on arrival when there is none, and after an order is placed. */
    newCheckoutKey: create.preparedReducer(
      () => ({ payload: newUuid() }),
      (state, action: PayloadAction<string>) => {
        state.idempotencyKey = action.payload;
      },
    ),
    chooseAddress: create.reducer((state, action: PayloadAction<string>) => {
      state.addressId = action.payload;
      state.addressSheetOpen = false;
    }),
    setAddressSheet: create.reducer((state, action: PayloadAction<boolean>) => {
      state.addressSheetOpen = action.payload;
    }),
    choosePayment: create.reducer((state, action: PayloadAction<{ storeId: string; method: PaymentMethod }>) => {
      (state.choices[action.payload.storeId] ??= blankChoice()).paymentMethod = action.payload.method;
    }),
    setStoreNote: create.reducer((state, action: PayloadAction<{ storeId: string; note: string }>) => {
      (state.choices[action.payload.storeId] ??= blankChoice()).note = action.payload.note.slice(0, 300);
    }),
    applyCoupon: create.reducer((state, action: PayloadAction<{ storeId: string; code: string | null }>) => {
      const code = action.payload.code?.trim().toUpperCase() || null;
      (state.choices[action.payload.storeId] ??= blankChoice()).couponCode = code;
      state.couponSheet.storeId = null;
    }),
    openCouponSheet: create.reducer((state, action: PayloadAction<string>) => {
      state.couponSheet = { storeId: action.payload, input: '', coupons: [], status: 'idle' };
    }),
    closeCouponSheet: create.reducer(state => {
      state.couponSheet.storeId = null;
    }),
    setCouponInput: create.reducer((state, action: PayloadAction<string>) => {
      state.couponSheet.input = action.payload.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
    }),
    clearPlaceError: create.reducer(state => {
      state.placeError = NO_ERROR;
    }),

    previewCheckoutAsync: create.asyncThunk(
      async (input: CheckoutInput, { rejectWithValue }) => {
        try {
          return required(checkoutPreviewSerializer(await previewCheckout(input)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.previewStatus = 'loading';
          state.previewError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.previewStatus = 'succeeded';
          state.preview = action.payload;
          // The server may fall back (COD over the store's limit): show what it will use.
          for (const s of action.payload.stores) {
            (state.choices[s.store.id] ??= blankChoice()).paymentMethod = s.paymentMethod;
          }
        },
        rejected: (state, action) => {
          state.previewStatus = 'failed';
          state.previewError = readRejection(action, "We couldn't price your order.");
        },
      },
    ),

    loadCouponsAsync: create.asyncThunk(
      async (storeId: string, { rejectWithValue }) => {
        try {
          return required(availableCouponListSerializer(await fetchAvailableCoupons(storeId)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.couponSheet.status = 'loading';
        },
        fulfilled: (state, action) => {
          if (state.couponSheet.storeId !== action.meta.arg) return;
          state.couponSheet.status = 'succeeded';
          state.couponSheet.coupons = action.payload;
        },
        rejected: state => {
          state.couponSheet.status = 'failed';
        },
      },
    ),

    placeOrderAsync: create.asyncThunk(
      async ({ input, key }: { input: CheckoutInput; key: string }, { rejectWithValue }) => {
        try {
          return required(orderGroupSerializer(await placeOrder(input, key)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.placeStatus = 'loading';
          state.placeError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.placeStatus = 'succeeded';
          state.placed = action.payload;
          state.choices = {};
          state.preview = null;
        },
        rejected: (state, action) => {
          state.placeStatus = 'failed';
          state.placeError = readRejection(action, "We couldn't place your order. Try again; it won't be placed twice.");
        },
      },
    ),
  }),
  selectors: {
    selectCheckout: state => state,
  },
});

export const {
  newCheckoutKey,
  chooseAddress,
  setAddressSheet,
  choosePayment,
  setStoreNote,
  applyCoupon,
  openCouponSheet,
  closeCouponSheet,
  setCouponInput,
  clearPlaceError,
  previewCheckoutAsync,
  loadCouponsAsync,
  placeOrderAsync,
} = checkoutSlice.actions;
export const { selectCheckout } = checkoutSlice.selectors;
