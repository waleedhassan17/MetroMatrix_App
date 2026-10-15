// ═══════════════════════════════════════════════════════
// MetroMatrix — Store return detail slice
// ═══════════════════════════════════════════════════════
// requested → approve (with instructions) or decline (with a reason) →
// received (restock each item or not) → refund recorded (amount + reference).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { approveReturn, getPartnerReturn, receiveReturn, recordRefund, rejectReturn } from '@networks/shopping/partner/partnerReturnsNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { ReturnRequest } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export type ReturnStep = { kind: 'approve'; note: string } | { kind: 'reject'; note: string } | { kind: 'receive'; restock: Record<string, boolean> } | { kind: 'refund'; amount: number; reference: string };

export interface StoreReturnDetailSliceState {
  ret: ReturnRequest | null;
  status: FormStatus;
  error: ServerError;
  busy: ReturnStep['kind'] | null;
  note: string;
  restock: Record<string, boolean>;
  amount: string;
  reference: string;
}

const initialState: StoreReturnDetailSliceState = {
  ret: null,
  status: 'idle',
  error: NO_ERROR,
  busy: null,
  note: '',
  restock: {},
  amount: '',
  reference: '',
};

const perform = (id: string, s: ReturnStep) =>
  s.kind === 'approve'
    ? approveReturn(id, s.note.trim() || null)
    : s.kind === 'reject'
      ? rejectReturn(id, s.note.trim())
      : s.kind === 'receive'
        ? receiveReturn(id, s.restock)
        : recordRefund(id, { amount: s.amount, reference: s.reference.trim() });

export const storeReturnDetailSlice = createAppSlice({
  name: 'storeReturnDetail',
  initialState,
  reducers: create => ({
    setReturnNote: create.reducer((state, action: PayloadAction<string>) => {
      state.note = action.payload.slice(0, 300);
    }),
    toggleRestock: create.reducer((state, action: PayloadAction<string>) => {
      state.restock[action.payload] = !state.restock[action.payload];
    }),
    setRefundAmount: create.reducer((state, action: PayloadAction<string>) => {
      state.amount = action.payload.replace(/\D/g, '').slice(0, 7);
    }),
    setRefundReference: create.reducer((state, action: PayloadAction<string>) => {
      state.reference = action.payload.toUpperCase().slice(0, 40);
    }),
    loadStoreReturnAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return await getPartnerReturn(id);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          if (state.ret?.id !== action.meta.arg) return { ...initialState, status: 'loading' };
          state.status = 'loading';
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.ret = action.payload;
          if (!Object.keys(state.restock).length) {
            // Restock by default; the store unticks a damaged item.
            state.restock = Object.fromEntries(action.payload.items.map(i => [i.orderItemId, true]));
          }
          if (!state.amount) state.amount = String(action.payload.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0));
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't open this return.");
        },
      },
    ),
    returnStepAsync: create.asyncThunk(
      async ({ id, step }: { id: string; step: ReturnStep }, { rejectWithValue }) => {
        try {
          return await perform(id, step);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busy = action.meta.arg.step.kind;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = null;
          state.ret = action.payload;
          state.note = '';
        },
        rejected: (state, action) => {
          state.busy = null;
          state.error = readRejection(action, "That didn't go through.");
        },
      },
    ),
  }),
  selectors: {
    selectStoreReturnDetail: state => state,
  },
});

export const { setReturnNote, toggleRestock, setRefundAmount, setRefundReference, loadStoreReturnAsync, returnStepAsync } = storeReturnDetailSlice.actions;
export const { selectStoreReturnDetail } = storeReturnDetailSlice.selectors;
