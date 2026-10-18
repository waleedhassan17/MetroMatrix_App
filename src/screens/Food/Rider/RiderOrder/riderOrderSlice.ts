// ═══════════════════════════════════════════════════════
// MetroMatrix — Food rider: one delivery
// ═══════════════════════════════════════════════════════
// The delivery (where to collect, where to drop, what to collect) and its
// steps: accept, at the kitchen, picked up, at the customer, delivered (with
// the cash taken), or hand it back before pickup. Kept per id.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { declineDelivery, getRiderOrder, markRiderDelivered, riderStep, type RiderStepAction } from '@networks/food/rider/riderNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { RiderOrder } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export interface RiderOrderEntry {
  order: RiderOrder | null;
  status: FormStatus;
  error: ServerError;
}

export interface RiderOrderSliceState {
  byId: Record<string, RiderOrderEntry>;
  acting: string | null;
  actionError: ServerError;
  sheet: 'decline' | 'deliver' | null;
  /** The cash typed at the door (rupees). */
  cash: string;
  /** Handed back: the page closes. */
  declinedId: string | null;
}

const EMPTY: RiderOrderEntry = { order: null, status: 'idle', error: NO_ERROR };
const initialState: RiderOrderSliceState = { byId: {}, acting: null, actionError: NO_ERROR, sheet: null, cash: '', declinedId: null };

const put = (state: RiderOrderSliceState, o: RiderOrder) => {
  state.byId[o.id] = { order: o, status: 'succeeded', error: NO_ERROR };
};

export const riderOrderSlice = createAppSlice({
  name: 'riderOrder',
  initialState,
  reducers: create => ({
    openRiderSheet: create.reducer((state, action: PayloadAction<{ sheet: 'decline' | 'deliver' | null; cash?: number }>) => {
      state.sheet = action.payload.sheet;
      state.actionError = NO_ERROR;
      if (action.payload.cash !== undefined) state.cash = String(action.payload.cash);
    }),
    setRiderCash: create.reducer((state, action: PayloadAction<string>) => {
      state.cash = action.payload.replace(/[^\d]/g, '').slice(0, 7);
    }),

    loadRiderOrderAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return await getRiderOrder(id);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const e = (state.byId[action.meta.arg] ??= { ...EMPTY });
          e.status = 'loading';
          e.error = NO_ERROR;
          state.declinedId = null;
        },
        fulfilled: (state, action) => put(state, action.payload),
        rejected: (state, action) => {
          const e = (state.byId[action.meta.arg] ??= { ...EMPTY });
          e.status = 'failed';
          e.error = readRejection(action, "This delivery didn't load.");
        },
      },
    ),

    riderStepAsync: create.asyncThunk(
      async ({ id, step }: { id: string; step: RiderStepAction }, { rejectWithValue }) => {
        try {
          return await riderStep(id, step);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.acting = action.meta.arg.step;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.acting = null;
          put(state, action.payload);
        },
        rejected: (state, action) => {
          state.acting = null;
          state.actionError = readRejection(action, "That didn't go through.");
        },
      },
    ),

    riderDeliveredAsync: create.asyncThunk(
      async ({ id, cash }: { id: string; cash: number | null }, { rejectWithValue }) => {
        try {
          return await markRiderDelivered(id, cash);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.acting = 'delivered';
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.acting = null;
          state.sheet = null;
          put(state, action.payload);
        },
        rejected: (state, action) => {
          state.acting = null;
          state.actionError = readRejection(action, "That didn't go through.");
        },
      },
    ),

    riderDeclineAsync: create.asyncThunk(
      async ({ id, reason }: { id: string; reason: string }, { rejectWithValue }) => {
        try {
          await declineDelivery(id, reason);
          return id;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.acting = 'decline';
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.acting = null;
          state.sheet = null;
          state.declinedId = action.payload;
          delete state.byId[action.payload];
        },
        rejected: (state, action) => {
          state.acting = null;
          state.actionError = readRejection(action, "That didn't go through.");
        },
      },
    ),
  }),
  selectors: {
    selectRiderOrderEntry: (state, id: string): RiderOrderEntry => state.byId[id] ?? EMPTY,
    selectRiderOrderUi: state => state,
  },
});

export const { openRiderSheet, setRiderCash, loadRiderOrderAsync, riderStepAsync, riderDeliveredAsync, riderDeclineAsync } = riderOrderSlice.actions;
export const { selectRiderOrderEntry, selectRiderOrderUi } = riderOrderSlice.selectors;
