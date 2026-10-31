// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: one order
// ═══════════════════════════════════════════════════════
// The kitchen's view of an order (the customer's contact, the lines with
// their notes, the money and how it's paid, the history) and the moves the
// server says it can make now. Kept per id; read again on live updates.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../../store/createAppSlice';
import { suggestRidersAPI } from '../../../../networks/food/vendor/ridersNetwork';
import {
  acceptOrderAPI,
  assignRiderAPI,
  cancelVendorOrderAPI,
  confirmPaymentAPI,
  getVendorOrderAPI,
  handedExternalAPI,
  markCollectedAPI,
  markDeliveredAPI,
  markReadyAPI,
  rejectOrderAPI,
  rejectPaymentAPI,
  startPreparingAPI,
} from '../../../../networks/food/vendor/ordersNetwork';
import { getKitchenSettingsAPI } from '../../../../networks/kitchen/costingNetwork';
import { attachPackingPhotoAPI } from '../../../../networks/kitchen/packingNetwork';
import { uploadImage } from '../../../../services/mediaUpload';
import { getBatchSuggestionsAPI } from '../../../../networks/foodGrowth/batchingNetwork';
import { toRejectedValue, required } from '../../../../networks/network/apiHelpers';
import type { BatchSuggestion, LocalFile, PackingPhotoRule, PackingResult, RiderSuggestion, VendorFoodOrder } from '../../../../types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { vendorFoodOrderSerializer } from '../../../../serializers/food/orderSerializer';
import { riderSuggestionsSerializer } from '../../../../serializers/food/riderSerializer';
import { kitchenSettingsSerializer } from '../../../../serializers/kitchen/recipeSerializer';
import { packingResultSerializer } from '../../../../serializers/kitchen/insightSerializer';
import { batchSuggestionsSerializer } from '../../../../serializers/kitchen/reachSerializer';

export type VendorOrderAct =
  | { kind: 'accept'; eta: number }
  | { kind: 'assign'; riderId: string }
  | { kind: 'reject'; reason: string }
  | { kind: 'cancel'; reason: string }
  | { kind: 'preparing' }
  | { kind: 'ready' }
  | { kind: 'handed-external' }
  | { kind: 'picked-up' }
  | { kind: 'delivered' }
  | { kind: 'confirm-payment' }
  | { kind: 'reject-payment'; reason: string };

/** Which reason sheet is open. */
export type ReasonSheet = 'reject' | 'cancel' | 'reject-payment' | null;

export interface VendorOrderEntry {
  order: VendorFoodOrder | null;
  status: FormStatus;
  error: ServerError;
}

export interface VendorOrderSliceState {
  byId: Record<string, VendorOrderEntry>;
  acting: VendorOrderAct['kind'] | null;
  actionError: ServerError;
  sheet: ReasonSheet;
  /** The rider picker: open, and its suggestions (fewest deliveries, then nearest). */
  assignOpen: boolean;
  suggestions: RiderSuggestion[];
  suggestStatus: FormStatus;
  /** Orders that could ride with this one (TODO(API_KITCHEN)), and the ones picked to go too. */
  batch: BatchSuggestion[];
  together: string[];
  /** The kitchen's packing-photo rule (TODO(API_KITCHEN)), and the photo being taken. */
  packingRule: PackingPhotoRule | null;
  packingUploading: boolean;
  packingCheck: PackingResult['check'];
  packingError: ServerError;
}

const EMPTY: VendorOrderEntry = { order: null, status: 'idle', error: NO_ERROR };
const initialState: VendorOrderSliceState = {
  byId: {},
  acting: null,
  actionError: NO_ERROR,
  sheet: null,
  assignOpen: false,
  suggestions: [],
  suggestStatus: 'idle',
  batch: [],
  together: [],
  packingRule: null,
  packingUploading: false,
  packingCheck: null,
  packingError: NO_ERROR,
};

const run = (id: string, a: VendorOrderAct) => {
  switch (a.kind) {
    case 'accept':
      return acceptOrderAPI(id, a.eta).then(raw => required(vendorFoodOrderSerializer(raw)));
    case 'assign':
      return assignRiderAPI(id, a.riderId).then(raw => required(vendorFoodOrderSerializer(raw)));
    case 'reject':
      return rejectOrderAPI(id, a.reason).then(raw => required(vendorFoodOrderSerializer(raw)));
    case 'cancel':
      return cancelVendorOrderAPI(id, a.reason).then(raw => required(vendorFoodOrderSerializer(raw)));
    case 'preparing':
      return startPreparingAPI(id).then(raw => required(vendorFoodOrderSerializer(raw)));
    case 'ready':
      return markReadyAPI(id).then(raw => required(vendorFoodOrderSerializer(raw)));
    case 'handed-external':
      return handedExternalAPI(id).then(raw => required(vendorFoodOrderSerializer(raw)));
    case 'picked-up':
      return markCollectedAPI(id).then(raw => required(vendorFoodOrderSerializer(raw)));
    case 'delivered':
      return markDeliveredAPI(id, null).then(raw => required(vendorFoodOrderSerializer(raw)));
    case 'confirm-payment':
      return confirmPaymentAPI(id).then(raw => required(vendorFoodOrderSerializer(raw)));
    case 'reject-payment':
      return rejectPaymentAPI(id, a.reason).then(raw => required(vendorFoodOrderSerializer(raw)));
  }
};

export const vendorOrderSlice = createAppSlice({
  name: 'vendorOrder',
  initialState,
  reducers: create => ({
    setReasonSheet: create.reducer((state, action: PayloadAction<ReasonSheet>) => {
      state.sheet = action.payload;
      state.actionError = NO_ERROR;
    }),
    setAssignOpen: create.reducer((state, action: PayloadAction<boolean>) => {
      state.assignOpen = action.payload;
      state.actionError = NO_ERROR;
      if (action.payload) state.together = [];
    }),
    toggleTogether: create.reducer((state, action: PayloadAction<string>) => {
      state.together = state.together.includes(action.payload) ? state.together.filter(x => x !== action.payload) : [...state.together, action.payload];
    }),

    /** The riders, and (softly) the orders going the same way. */
    loadSuggestionsAsync: create.asyncThunk(
      async (orderId: string, { rejectWithValue }) => {
        try {
          const [riders, batch] = await Promise.all([suggestRidersAPI(orderId).then(raw => required(riderSuggestionsSerializer(raw))), getBatchSuggestionsAPI(orderId).then(raw => required(batchSuggestionsSerializer(raw))).catch(() => [] as BatchSuggestion[])]);
          return { riders, batch };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.suggestStatus = 'loading';
        },
        fulfilled: (state, action) => {
          state.suggestStatus = 'succeeded';
          state.suggestions = action.payload.riders;
          state.batch = action.payload.batch;
          state.together = state.together.filter(x => action.payload.batch.some(b => b.orderId === x));
        },
        rejected: (state, action) => {
          state.suggestStatus = 'failed';
          state.actionError = readRejection(action, "Your riders didn't load.");
        },
      },
    ),

    /** The orders picked to ride along go to the same rider (after this one). */
    assignTogetherAsync: create.asyncThunk(
      async ({ orderIds, riderId }: { orderIds: string[]; riderId: string }, { rejectWithValue }) => {
        try {
          for (const orderId of orderIds) await assignRiderAPI(orderId, riderId);
          return orderIds.length;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: state => {
          state.together = [];
        },
        rejected: (state, action) => {
          state.actionError = readRejection(action, "The other order didn't go to the rider.");
        },
      },
    ),

    /** Soft: without it there is simply no packing step. */
    loadPackingRuleAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return (required(kitchenSettingsSerializer(await getKitchenSettingsAPI())))?.packingPhoto ?? 'off';
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          state.packingRule = action.payload;
        },
      },
    ),

    /** The photo of the packed order: uploaded, attached, then the order read again. */
    packingPhotoAsync: create.asyncThunk(
      async ({ id, file }: { id: string; file: LocalFile }, { rejectWithValue }) => {
        try {
          const uploaded = await uploadImage(file, 'food_packing');
          const result = required(packingResultSerializer(await attachPackingPhotoAPI(id, uploaded.url)));
          const order = required(vendorFoodOrderSerializer(await getVendorOrderAPI(id)));
          return { result, order };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.packingUploading = true;
          state.packingCheck = null;
          state.packingError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.packingUploading = false;
          state.packingCheck = action.payload.result?.check ?? null;
          state.byId[action.meta.arg.id] = { order: action.payload.order, status: 'succeeded', error: NO_ERROR };
        },
        rejected: (state, action) => {
          state.packingUploading = false;
          state.packingError = readRejection(action, "The photo didn't upload.");
        },
      },
    ),

    loadVendorOrderAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return required(vendorFoodOrderSerializer(await getVendorOrderAPI(id)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const e = (state.byId[action.meta.arg] ??= { ...EMPTY });
          e.status = 'loading';
          e.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.byId[action.meta.arg] = { order: action.payload, status: 'succeeded', error: NO_ERROR };
        },
        rejected: (state, action) => {
          const e = (state.byId[action.meta.arg] ??= { ...EMPTY });
          e.status = 'failed';
          e.error = readRejection(action, "This order didn't load.");
        },
      },
    ),

    vendorOrderActAsync: create.asyncThunk(
      async ({ id, act }: { id: string; act: VendorOrderAct }, { rejectWithValue }) => {
        try {
          return await run(id, act);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.acting = action.meta.arg.act.kind;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const kind = action.meta.arg.act.kind;
          state.acting = null;
          // Only the sheet this move came from closes: a move that lands while
          // another sheet is open (Ready finishing as the rider picker opens)
          // leaves it open.
          if (kind === 'reject' || kind === 'cancel' || kind === 'reject-payment') state.sheet = null;
          if (kind === 'assign' || kind === 'handed-external') state.assignOpen = false;
          state.byId[action.meta.arg.id] = { order: action.payload, status: 'succeeded', error: NO_ERROR };
        },
        rejected: (state, action) => {
          state.acting = null;
          state.actionError = readRejection(action, "That didn't go through.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorOrderEntry: (state, id: string): VendorOrderEntry => state.byId[id] ?? EMPTY,
    selectVendorOrderUi: state => state,
  },
});

export const { setReasonSheet, setAssignOpen, toggleTogether, loadSuggestionsAsync, assignTogetherAsync, loadPackingRuleAsync, packingPhotoAsync, loadVendorOrderAsync, vendorOrderActAsync } = vendorOrderSlice.actions;
export const { selectVendorOrderEntry, selectVendorOrderUi } = vendorOrderSlice.selectors;
