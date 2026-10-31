// ═══════════════════════════════════════════════════════
// MetroMatrix — Store order detail slice (keyed by order id)
// ═══════════════════════════════════════════════════════
// The order, the actions the server allows on it now, and the sheets that
// collect what an action needs (courier + tracking or the rider, a reason,
// the refund sent).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import {
  approveCancellation,
  cancelPartnerOrder,
  confirmOrder,
  confirmPayment,
  deliverOrder,
  fetchPartnerOrder,
  markCashCollected,
  packOrder,
  recordOrderRefund,
  rejectPayment,
  shipOrder,
  type ShipInput,
} from '../../networks/shopping/partner/partnerOrders';
import { toRejectedValue } from '../../networks/network/network';
import type { CourierKey, PartnerOrderAction, PartnerOrderDetail } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { partnerOrderDetailSerializer } from '../../serializers/shopping/partnerSerializer';

export interface StoreOrderEntry {
  order: PartnerOrderDetail | null;
  status: FormStatus;
  error: ServerError;
}

export type StoreOrderSheet = 'ship' | 'cancel' | 'reject_payment' | null;

export interface StoreOrderDetailSliceState {
  byId: Record<string, StoreOrderEntry>;
  busy: PartnerOrderAction | null;
  actionError: ServerError;
  sheet: StoreOrderSheet;
  courier: CourierKey | null;
  trackingRef: string;
  riderName: string;
  /** The rider's national number, typed after "+92". */
  riderPhone: string;
  reason: string;
  refundAmount: string;
  refundReference: string;
}

const EMPTY: StoreOrderEntry = { order: null, status: 'idle', error: NO_ERROR };

const initialState: StoreOrderDetailSliceState = {
  byId: {},
  busy: null,
  actionError: NO_ERROR,
  sheet: null,
  courier: null,
  trackingRef: '',
  riderName: '',
  riderPhone: '',
  reason: '',
  refundAmount: '',
  refundReference: '',
};

export type StoreOrderActionInput =
  | { action: 'confirm' | 'pack' | 'deliver' | 'confirm_payment' | 'cash_collected' | 'approve_cancellation' }
  | ({ action: 'ship' } & ShipInput)
  | { action: 'cancel' | 'reject_payment'; reason: string }
  | { action: 'refund'; amount: number; reference: string };

const perform = (id: string, a: StoreOrderActionInput): Promise<unknown> => {
  switch (a.action) {
    case 'confirm':
      return confirmOrder(id);
    case 'pack':
      return packOrder(id);
    case 'ship':
      return shipOrder(id, a);
    case 'deliver':
      return deliverOrder(id);
    case 'cancel':
      return cancelPartnerOrder(id, a.reason.trim());
    case 'approve_cancellation':
      return approveCancellation(id);
    case 'confirm_payment':
      return confirmPayment(id);
    case 'reject_payment':
      return rejectPayment(id, a.reason.trim());
    case 'cash_collected':
      return markCashCollected(id);
    case 'refund':
      return recordOrderRefund(id, { amount: a.amount, reference: a.reference });
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
    setRiderName: create.reducer((state, action: PayloadAction<string>) => {
      state.riderName = action.payload.slice(0, 80);
    }),
    setRiderPhone: create.reducer((state, action: PayloadAction<string>) => {
      state.riderPhone = action.payload.replace(/\D/g, '').slice(0, 10);
    }),
    setStoreOrderReason: create.reducer((state, action: PayloadAction<string>) => {
      state.reason = action.payload;
    }),
    setOrderRefundAmount: create.reducer((state, action: PayloadAction<string>) => {
      state.refundAmount = action.payload.replace(/\D/g, '').slice(0, 8);
    }),
    setOrderRefundReference: create.reducer((state, action: PayloadAction<string>) => {
      state.refundReference = action.payload.toUpperCase().slice(0, 80);
    }),
    loadStoreOrderAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return await fetchPartnerOrder(id);
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
          const payload = partnerOrderDetailSerializer(action.payload);
          const first = !state.byId[action.meta.arg]?.order;
          if (!payload) return;
          state.byId[action.meta.arg] = { order: payload, status: 'succeeded', error: NO_ERROR };
          if (first) {
            state.courier = payload.shipment?.courier ?? state.courier;
            state.refundAmount = String(payload.total);
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
          const payload = partnerOrderDetailSerializer(action.payload);
          state.busy = null;
          state.sheet = null;
          state.trackingRef = '';
          state.refundReference = '';
          if (!payload) return;
          state.byId[action.meta.arg.id] = { order: payload, status: 'succeeded', error: NO_ERROR };
        },
        rejected: (state, action) => {
          state.busy = null;
          state.actionError = readRejection(action, "That didn't go through. Pull down to refresh.");
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
  setRiderName,
  setRiderPhone,
  setStoreOrderReason,
  setOrderRefundAmount,
  setOrderRefundReference,
  loadStoreOrderAsync,
  storeOrderActionAsync,
} = storeOrderDetailSlice.actions;
export const { selectStoreOrder, selectStoreOrderUi } = storeOrderDetailSlice.selectors;
