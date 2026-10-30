// ═══════════════════════════════════════════════════════
// MetroMatrix — Store order detail slice (keyed by order id)
// ═══════════════════════════════════════════════════════
// The order, the actions the server allows on it now, and the sheets that
// collect what an action needs (courier + tracking, a reason).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import {
  approveCancellationAPI,
  cancelPartnerOrderAPI,
  confirmOrderAPI,
  confirmPaymentAPI,
  deliverOrderAPI,
  getPartnerOrderAPI,
  markCashCollectedAPI,
  packOrderAPI,
  rejectPaymentAPI,
  saveInternalNoteAPI,
  shipOrderAPI,
} from '@networks/shopping/partner/partnerOrdersNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { CourierKey, PartnerOrderAction, PartnerOrderDetail } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { partnerOrderDetailSerializer } from '@serializers/shopping/partnerSerializer';

export interface StoreOrderEntry {
  order: PartnerOrderDetail | null;
  status: FormStatus;
  error: ServerError;
}

export type StoreOrderSheet = 'ship' | 'cancel' | 'reject_payment' | null;

export interface StoreOrderDetailSliceState {
  byId: Record<string, StoreOrderEntry>;
  busy: PartnerOrderAction | 'note' | null;
  actionError: ServerError;
  sheet: StoreOrderSheet;
  courier: CourierKey | null;
  trackingRef: string;
  reason: string;
  note: string;
}

const EMPTY: StoreOrderEntry = { order: null, status: 'idle', error: NO_ERROR };

const initialState: StoreOrderDetailSliceState = {
  byId: {},
  busy: null,
  actionError: NO_ERROR,
  sheet: null,
  courier: null,
  trackingRef: '',
  reason: '',
  note: '',
};

export type StoreOrderActionInput =
  | { action: 'confirm' | 'pack' | 'deliver' | 'confirm_payment' | 'cash_collected' | 'approve_cancellation' }
  | { action: 'ship'; courier: CourierKey; trackingRef: string }
  | { action: 'cancel' | 'reject_payment'; reason: string };

const perform = (id: string, a: StoreOrderActionInput) => {
  switch (a.action) {
    case 'confirm':
      return confirmOrderAPI(id).then(raw => required(partnerOrderDetailSerializer(raw)));
    case 'pack':
      return packOrderAPI(id).then(raw => required(partnerOrderDetailSerializer(raw)));
    case 'ship':
      return shipOrderAPI(id, { courier: a.courier, trackingRef: a.trackingRef.trim() }).then(raw => required(partnerOrderDetailSerializer(raw)));
    case 'deliver':
      return deliverOrderAPI(id).then(raw => required(partnerOrderDetailSerializer(raw)));
    case 'cancel':
      return cancelPartnerOrderAPI(id, a.reason.trim()).then(raw => required(partnerOrderDetailSerializer(raw)));
    case 'approve_cancellation':
      return approveCancellationAPI(id).then(raw => required(partnerOrderDetailSerializer(raw)));
    case 'confirm_payment':
      return confirmPaymentAPI(id).then(raw => required(partnerOrderDetailSerializer(raw)));
    case 'reject_payment':
      return rejectPaymentAPI(id, a.reason.trim()).then(raw => required(partnerOrderDetailSerializer(raw)));
    case 'cash_collected':
      return markCashCollectedAPI(id).then(raw => required(partnerOrderDetailSerializer(raw)));
  }
};

export const storeOrderDetailSlice = createAppSlice({
  name: 'storeOrderDetail',
  initialState,
  reducers: create => ({
    openStoreOrderSheet: create.reducer((state, action: PayloadAction<StoreOrderSheet>) => {
      state.sheet = action.payload;
      state.reason = '';
      state.actionError = NO_ERROR;
    }),
    setCourier: create.reducer((state, action: PayloadAction<CourierKey>) => {
      state.courier = action.payload;
    }),
    setTrackingRef: create.reducer((state, action: PayloadAction<string>) => {
      state.trackingRef = action.payload.toUpperCase();
    }),
    setStoreOrderReason: create.reducer((state, action: PayloadAction<string>) => {
      state.reason = action.payload;
    }),
    setInternalNote: create.reducer((state, action: PayloadAction<string>) => {
      state.note = action.payload.slice(0, 500);
    }),

    loadStoreOrderAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return required(partnerOrderDetailSerializer(await getPartnerOrderAPI(id)));
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
          const first = !state.byId[action.meta.arg]?.order;
          state.byId[action.meta.arg] = { order: action.payload, status: 'succeeded', error: NO_ERROR };
          if (first) {
            state.note = action.payload.internalNote ?? '';
            state.courier = action.payload.shipment?.courier ?? state.courier;
          }
        },
        rejected: (state, action) => {
          const e = (state.byId[action.meta.arg] ??= { ...EMPTY });
          e.status = 'failed';
          e.error = readRejection(action, "We couldn't open this order.");
        },
      },
    ),

    storeOrderActionAsync: create.asyncThunk(
      async ({ id, input }: { id: string; input: StoreOrderActionInput }, { rejectWithValue }) => {
        try {
          return await perform(id, input);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busy = action.meta.arg.input.action;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = null;
          state.sheet = null;
          state.trackingRef = '';
          state.byId[action.meta.arg.id] = { order: action.payload, status: 'succeeded', error: NO_ERROR };
        },
        rejected: (state, action) => {
          state.busy = null;
          state.actionError = readRejection(action, "That didn't go through. Pull down to refresh.");
        },
      },
    ),

    saveNoteAsync: create.asyncThunk(
      async ({ id, note }: { id: string; note: string }, { rejectWithValue }) => {
        try {
          return required(partnerOrderDetailSerializer(await saveInternalNoteAPI(id, note.trim())));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = 'note';
        },
        fulfilled: (state, action) => {
          state.busy = null;
          state.byId[action.meta.arg.id] = { order: action.payload, status: 'succeeded', error: NO_ERROR };
        },
        rejected: (state, action) => {
          state.busy = null;
          state.actionError = readRejection(action, "We couldn't save the note.");
        },
      },
    ),
  }),
  selectors: {
    selectStoreOrder: (state, id: string): StoreOrderEntry => state.byId[id] ?? EMPTY,
    selectStoreOrderUi: state => state,
  },
});

export const {
  openStoreOrderSheet,
  setCourier,
  setTrackingRef,
  setStoreOrderReason,
  setInternalNote,
  loadStoreOrderAsync,
  storeOrderActionAsync,
  saveNoteAsync,
} = storeOrderDetailSlice.actions;
export const { selectStoreOrder, selectStoreOrderUi } = storeOrderDetailSlice.selectors;
