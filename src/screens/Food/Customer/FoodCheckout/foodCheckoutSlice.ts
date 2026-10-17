// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: checkout
// ═══════════════════════════════════════════════════════
// Where it goes (or pick-up), how the customer pays the kitchen, a code,
// cutlery and notes. The server prices it all (preview) after each change
// settles and says what stands in the way, first problem first.
//
// Placing is idempotent: the Idempotency-Key is made once (a prepared
// reducer — randomUUID is impure), kept across retries, and renewed only
// after an order is placed. A double tap or a lost response can never place
// two orders.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { newUuid } from '@utils/ids';
import { previewFoodCart } from '@networks/food/cartNetwork';
import { placeFoodOrder } from '@networks/food/ordersNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { MAX_BUILDING, MAX_FLOOR, MAX_KITCHEN_NOTE, MAX_RIDER_NOTE, cleanCode } from '@models/food/bagModel';
import type { FoodCheckoutInput, FoodOrder, FoodPaymentMethod, FoodPreview } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export interface FoodCheckoutSliceState {
  addressId: string | null;
  paymentMethod: FoodPaymentMethod | null;
  /** The code sent with the preview (applied), and what is being typed. */
  promoCode: string;
  codeInput: string;
  cutlery: boolean;
  note: string;
  building: string;
  floor: string;
  riderInstructions: string;
  preview: FoodPreview | null;
  previewStatus: FormStatus;
  previewError: ServerError;
  idempotencyKey: string;
  placeStatus: FormStatus;
  placeError: ServerError;
  /** The order just placed (the "order placed" page reads it). */
  placed: FoodOrder | null;
  addressSheetOpen: boolean;
}

const initialState: FoodCheckoutSliceState = {
  addressId: null,
  paymentMethod: null,
  promoCode: '',
  codeInput: '',
  cutlery: false,
  note: '',
  building: '',
  floor: '',
  riderInstructions: '',
  preview: null,
  previewStatus: 'idle',
  previewError: NO_ERROR,
  idempotencyKey: '',
  placeStatus: 'idle',
  placeError: NO_ERROR,
  placed: null,
  addressSheetOpen: false,
};

/** The request, from what the customer chose. */
export const toFoodCheckoutInput = (s: FoodCheckoutSliceState, delivery: boolean): FoodCheckoutInput => ({
  addressId: delivery ? s.addressId : null,
  paymentMethod: s.paymentMethod ?? (delivery ? 'cod' : 'pay_at_pickup'),
  promoCode: s.promoCode || null,
  cutlery: s.cutlery,
  note: s.note.trim() || null,
  building: delivery ? s.building.trim() || null : null,
  floor: delivery ? s.floor.trim() || null : null,
  riderInstructions: delivery ? s.riderInstructions.trim() || null : null,
});

export const foodCheckoutSlice = createAppSlice({
  name: 'foodCheckout',
  initialState,
  reducers: create => ({
    /** A fresh key — on arrival when there is none, and after an order is placed. */
    newFoodCheckoutKey: create.preparedReducer(
      () => ({ payload: newUuid() }),
      (state, action: PayloadAction<string>) => {
        state.idempotencyKey = action.payload;
      },
    ),
    chooseFoodAddress: create.reducer((state, action: PayloadAction<string>) => {
      state.addressId = action.payload;
      state.addressSheetOpen = false;
    }),
    setFoodAddressSheet: create.reducer((state, action: PayloadAction<boolean>) => {
      state.addressSheetOpen = action.payload;
    }),
    chooseFoodPayment: create.reducer((state, action: PayloadAction<FoodPaymentMethod>) => {
      state.paymentMethod = action.payload;
    }),
    setCodeInput: create.reducer((state, action: PayloadAction<string>) => {
      state.codeInput = cleanCode(action.payload);
    }),
    applyFoodCode: create.reducer(state => {
      state.promoCode = cleanCode(state.codeInput);
    }),
    removeFoodCode: create.reducer(state => {
      state.promoCode = '';
      state.codeInput = '';
    }),
    setCutlery: create.reducer((state, action: PayloadAction<boolean>) => {
      state.cutlery = action.payload;
    }),
    setCheckoutText: create.reducer((state, action: PayloadAction<{ field: 'note' | 'building' | 'floor' | 'riderInstructions'; value: string }>) => {
      const max = { note: MAX_KITCHEN_NOTE, building: MAX_BUILDING, floor: MAX_FLOOR, riderInstructions: MAX_RIDER_NOTE }[action.payload.field];
      state[action.payload.field] = action.payload.value.slice(0, max);
    }),
    clearFoodPlaceError: create.reducer(state => {
      state.placeError = NO_ERROR;
    }),

    previewFoodCheckoutAsync: create.asyncThunk(
      async (input: Partial<FoodCheckoutInput>, { rejectWithValue }) => {
        try {
          return await previewFoodCart(input);
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
        },
        rejected: (state, action) => {
          state.previewStatus = 'failed';
          state.previewError = readRejection(action, "We couldn't price your order.");
        },
      },
    ),

    placeFoodOrderAsync: create.asyncThunk(
      async ({ input, key }: { input: FoodCheckoutInput; key: string }, { rejectWithValue }) => {
        try {
          return await placeFoodOrder(input, key);
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
          Object.assign(state, initialState, { placeStatus: 'succeeded', placed: action.payload, addressId: state.addressId, paymentMethod: state.paymentMethod });
        },
        rejected: (state, action) => {
          state.placeStatus = 'failed';
          state.placeError = readRejection(action, "We couldn't place your order. Try again; it won't be placed twice.");
        },
      },
    ),
  }),
  selectors: {
    selectFoodCheckout: state => state,
  },
});

export const {
  newFoodCheckoutKey,
  chooseFoodAddress,
  setFoodAddressSheet,
  chooseFoodPayment,
  setCodeInput,
  applyFoodCode,
  removeFoodCode,
  setCutlery,
  setCheckoutText,
  clearFoodPlaceError,
  previewFoodCheckoutAsync,
  placeFoodOrderAsync,
} = foodCheckoutSlice.actions;
export const { selectFoodCheckout } = foodCheckoutSlice.selectors;
