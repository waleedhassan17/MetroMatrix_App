// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: one order
// ═══════════════════════════════════════════════════════
// The kitchen's view of an order (the customer's contact, the lines with
// their notes, the money and how it's paid, the history) and the moves the
// server says it can make now. Kept per id; read again on live updates.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { suggestRiders } from '@networks/food/vendor/ridersNetwork';
import {
  acceptOrder,
  assignRider,
  cancelVendorOrder,
  confirmPayment,
  getVendorOrder,
  handedExternal,
  markCollected,
  markDelivered,
  markReady,
  rejectOrder,
  rejectPayment,
  startPreparing,
} from '@networks/food/vendor/ordersNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { RiderSuggestion, VendorFoodOrder } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

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
}

const EMPTY: VendorOrderEntry = { order: null, status: 'idle', error: NO_ERROR };
const initialState: VendorOrderSliceState = { byId: {}, acting: null, actionError: NO_ERROR, sheet: null, assignOpen: false, suggestions: [], suggestStatus: 'idle' };

const run = (id: string, a: VendorOrderAct) => {
  switch (a.kind) {
    case 'accept':
      return acceptOrder(id, a.eta);
    case 'assign':
      return assignRider(id, a.riderId);
    case 'reject':
      return rejectOrder(id, a.reason);
    case 'cancel':
      return cancelVendorOrder(id, a.reason);
    case 'preparing':
      return startPreparing(id);
    case 'ready':
      return markReady(id);
    case 'handed-external':
      return handedExternal(id);
    case 'picked-up':
      return markCollected(id);
    case 'delivered':
      return markDelivered(id, null);
    case 'confirm-payment':
      return confirmPayment(id);
    case 'reject-payment':
      return rejectPayment(id, a.reason);
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
    }),

    loadSuggestionsAsync: create.asyncThunk(
      async (orderId: string, { rejectWithValue }) => {
        try {
          return await suggestRiders(orderId);
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
          state.suggestions = action.payload;
        },
        rejected: (state, action) => {
          state.suggestStatus = 'failed';
          state.actionError = readRejection(action, "Your riders didn't load.");
        },
      },
    ),

    loadVendorOrderAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return await getVendorOrder(id);
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

export const { setReasonSheet, setAssignOpen, loadSuggestionsAsync, loadVendorOrderAsync, vendorOrderActAsync } = vendorOrderSlice.actions;
export const { selectVendorOrderEntry, selectVendorOrderUi } = vendorOrderSlice.selectors;
