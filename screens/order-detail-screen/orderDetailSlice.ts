// ═══════════════════════════════════════════════════════
// MetroMatrix — Order detail slice (keyed by order group code)
// ═══════════════════════════════════════════════════════
// One order group (what one checkout made) with its store orders, and the
// customer's actions on them. Every action answers with the whole group, so
// the screen always shows the server's state. Also read by Order placed,
// Payment proof, Return request and Write review.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { cancelOrder, confirmReceived, fetchOrderGroup, requestCancellation } from '../../networks/shopping/orders';
import { toRejectedValue, required } from '../../networks/network/network';
import type { OrderGroup } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { placeOrderAsync } from '../checkout-screen/checkoutSlice';
import { submitPaymentProofAsync } from '../payment-proof-screen/paymentProofSlice';
import { orderGroupSerializer } from '../../serializers/shopping/orderSerializer';

export interface OrderGroupEntry {
  group: OrderGroup | null;
  status: FormStatus;
  error: ServerError;
}

export type CancelKind = 'cancel' | 'request';

export interface OrderDetailSliceState {
  byCode: Record<string, OrderGroupEntry>;
  /** The store order an action is running for. */
  busyOrderId: string | null;
  actionError: ServerError;
  cancelSheet: { orderId: string | null; kind: CancelKind; reason: string | null; details: string };
}

const EMPTY: OrderGroupEntry = { group: null, status: 'idle', error: NO_ERROR };

const initialState: OrderDetailSliceState = {
  byCode: {},
  busyOrderId: null,
  actionError: NO_ERROR,
  cancelSheet: { orderId: null, kind: 'cancel', reason: null, details: '' },
};

export const CANCEL_REASONS = ['Ordered by mistake', 'Found it cheaper elsewhere', 'Delivery takes too long', 'Changed my mind', 'Something else'];

type Action = 'cancel' | 'request' | 'received';

const act = async (kind: Action, orderId: string, reason: string) =>
  kind === 'cancel' ? cancelOrder(orderId, reason).then(raw => required(orderGroupSerializer(raw))) : kind === 'request' ? requestCancellation(orderId, reason).then(raw => required(orderGroupSerializer(raw))) : confirmReceived(orderId).then(raw => required(orderGroupSerializer(raw)));

export const orderDetailSlice = createAppSlice({
  name: 'orderDetail',
  initialState,
  reducers: create => ({
    openCancelSheet: create.reducer((state, action: PayloadAction<{ orderId: string; kind: CancelKind }>) => {
      state.cancelSheet = { orderId: action.payload.orderId, kind: action.payload.kind, reason: null, details: '' };
      state.actionError = NO_ERROR;
    }),
    closeCancelSheet: create.reducer(state => {
      state.cancelSheet.orderId = null;
    }),
    setCancelReason: create.reducer((state, action: PayloadAction<string>) => {
      state.cancelSheet.reason = action.payload;
    }),
    setCancelDetails: create.reducer((state, action: PayloadAction<string>) => {
      state.cancelSheet.details = action.payload;
    }),

    loadOrderGroupAsync: create.asyncThunk(
      async (code: string, { rejectWithValue }) => {
        try {
          return await fetchOrderGroup(code);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const e = (state.byCode[action.meta.arg] ??= { ...EMPTY });
          e.status = 'loading';
          e.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = orderGroupSerializer(action.payload);
          state.byCode[action.meta.arg] = { group: payload, status: 'succeeded', error: NO_ERROR };
        },
        rejected: (state, action) => {
          const e = (state.byCode[action.meta.arg] ??= { ...EMPTY });
          e.status = 'failed';
          e.error = readRejection(action, "We couldn't open this order.");
        },
      },
    ),

    orderActionAsync: create.asyncThunk(
      async ({ kind, orderId, reason }: { kind: Action; orderId: string; reason?: string }, { rejectWithValue }) => {
        try {
          return await act(kind, orderId, reason ?? '');
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busyOrderId = action.meta.arg.orderId;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busyOrderId = null;
          state.cancelSheet.orderId = null;
          state.byCode[action.payload.code] = { group: action.payload, status: 'succeeded', error: NO_ERROR };
        },
        rejected: (state, action) => {
          state.busyOrderId = null;
          state.actionError = readRejection(action, "That didn't go through. Pull down to refresh and try again.");
        },
      },
    ),
  }),
  extraReducers: builder => {
    // A just-placed order opens without a second request.
    builder.addCase(placeOrderAsync.fulfilled, (state, action) => {
          const payload = orderGroupSerializer(action.payload);
      if (!payload) return;
      state.byCode[payload.code] = { group: payload, status: 'succeeded', error: NO_ERROR };
    });
    // A sent payment proof answers with the whole group, too.
    builder.addCase(submitPaymentProofAsync.fulfilled, (state, action) => {
          const payload = orderGroupSerializer(action.payload);
      if (!payload) return;
      state.byCode[payload.code] = { group: payload, status: 'succeeded', error: NO_ERROR };
    });
  },
  selectors: {
    selectOrderGroup: (state, code: string): OrderGroupEntry => state.byCode[code] ?? EMPTY,
    /** busyOrderId, actionError, cancelSheet (the slice itself, so the reference is stable). */
    selectOrderActions: state => state,
  },
});

export const { openCancelSheet, closeCancelSheet, setCancelReason, setCancelDetails, loadOrderGroupAsync, orderActionAsync } =
  orderDetailSlice.actions;
export const { selectOrderGroup, selectOrderActions } = orderDetailSlice.selectors;
