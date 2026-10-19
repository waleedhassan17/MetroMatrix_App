// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: the order board
// ═══════════════════════════════════════════════════════
// Every order still in the kitchen — New, Cooking, Ready, Out for delivery —
// oldest first, kept live by the board's socket (board.sync on connect,
// order.new, order.updated) and read again over REST after reconnects. The
// kitchen answers a new order (accept with a time, or decline with a
// reason) and moves the rest along; ended orders leave the board. The
// kitchen's own switches (pause, busy) sit on top.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { acceptOrder, handedExternal, listBoard, markCollected, markDelivered, markReady, rejectOrder, startPreparing } from '@networks/food/vendor/ordersNetwork';
import { getVendorProfile, pauseOrders, resumeOrders, setBusy } from '@networks/food/vendor/profileNetwork';
import { setAvailability } from '@networks/food/vendor/availabilityNetwork';
import { getBoardHints } from '@networks/kitchen/costingNetwork';
import { getAnnouncement } from '@networks/kitchen/packingNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { cardOfOrder, columnOf, isEnded, type BoardColumn } from '@models/food/foodStatusModel';
import type { BoardCard, BoardHints, FoodLiveBoardUpdate, PauseReason, VendorProfile } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export type BoardMove = 'preparing' | 'ready' | 'handed-external' | 'picked-up' | 'delivered';

export interface VendorBoardSliceState {
  cards: BoardCard[];
  status: FormStatus;
  error: ServerError;
  /** The phone layout's column. */
  column: BoardColumn;
  /** The order an action is in flight for. */
  busyId: string | null;
  actionError: ServerError;
  /** The new order the accept (ETA) or decline sheet is open for. */
  acceptFor: string | null;
  rejectFor: string | null;
  /** New orders the kitchen has opened (the alert stops once every new order is seen). */
  seen: string[];
  /** The kitchen's switches. */
  profile: VendorProfile | null;
  switching: boolean;
  /** The kitchen's side (TODO(API_KITCHEN)): dishes low or out by stock, the usual prep time, the packing-photo rule. */
  hints: BoardHints | null;
  /** The pause sheet (a private reason, and when it lifts by itself). */
  pauseOpen: boolean;
  /** New orders already spoken out loud. */
  announced: string[];
}

const initialState: VendorBoardSliceState = {
  cards: [],
  status: 'idle',
  error: NO_ERROR,
  column: 'new',
  busyId: null,
  actionError: NO_ERROR,
  acceptFor: null,
  rejectFor: null,
  seen: [],
  profile: null,
  switching: false,
  hints: null,
  pauseOpen: false,
  announced: [],
};

const byAge = (a: BoardCard, b: BoardCard) => a.placedAt.localeCompare(b.placedAt) || a.id.localeCompare(b.id);

/** Put a card on the board (replacing its old self), or take it off once the order has ended. */
const upsert = (state: VendorBoardSliceState, card: BoardCard) => {
  const rest = state.cards.filter(c => c.id !== card.id);
  state.cards = isEnded(card.status) || !columnOf(card.status) ? rest : [...rest, card].sort(byAge);
  if (state.acceptFor === card.id && card.status !== 'placed') state.acceptFor = null;
  if (state.rejectFor === card.id && card.status !== 'placed') state.rejectFor = null;
};

const MOVES: Record<BoardMove, (id: string) => ReturnType<typeof startPreparing>> = {
  preparing: startPreparing,
  ready: markReady,
  'handed-external': handedExternal,
  'picked-up': markCollected,
  delivered: id => markDelivered(id, null),
};

export const vendorBoardSlice = createAppSlice({
  name: 'vendorBoard',
  initialState,
  reducers: create => ({
    setBoardColumn: create.reducer((state, action: PayloadAction<BoardColumn>) => {
      state.column = action.payload;
    }),
    markOrderSeen: create.reducer((state, action: PayloadAction<string>) => {
      if (!state.seen.includes(action.payload)) state.seen.push(action.payload);
    }),
    openAccept: create.reducer((state, action: PayloadAction<string | null>) => {
      if (action.payload && !state.seen.includes(action.payload)) state.seen.push(action.payload);
      state.acceptFor = action.payload;
      state.rejectFor = null;
      state.actionError = NO_ERROR;
    }),
    openPause: create.reducer((state, action: PayloadAction<boolean>) => {
      state.pauseOpen = action.payload;
      state.actionError = NO_ERROR;
    }),
    openReject: create.reducer((state, action: PayloadAction<string | null>) => {
      if (action.payload && !state.seen.includes(action.payload)) state.seen.push(action.payload);
      state.rejectFor = action.payload;
      state.acceptFor = null;
      state.actionError = NO_ERROR;
    }),
    // ── Live ──
    boardSynced: create.reducer((state, action: PayloadAction<BoardCard[]>) => {
      state.cards = action.payload.filter(c => !!columnOf(c.status)).sort(byAge);
      state.status = 'succeeded';
    }),
    boardNewOrder: create.reducer((state, action: PayloadAction<BoardCard>) => {
      upsert(state, action.payload);
    }),
    boardOrderUpdated: create.reducer((state, action: PayloadAction<FoodLiveBoardUpdate>) => {
      const u = action.payload;
      if (u.order) upsert(state, u.order);
      else if (isEnded(u.status)) state.cards = state.cards.filter(c => c.id !== u.orderId);
    }),

    loadBoardAsync: create.asyncThunk(
      async (_: void, { dispatch, rejectWithValue }) => {
        try {
          const [fresh, active] = await Promise.all([listBoard('new'), listBoard('active')]);
          // Every board read reads the kitchen's side too.
          void dispatch(loadBoardHintsAsync());
          return [...fresh.items, ...active.items];
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          if (!state.cards.length) state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.cards = action.payload.filter(c => !!columnOf(c.status)).sort(byAge);
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The board didn't load.");
        },
      },
    ),

    /** Soft: without it the board still works, just without the kitchen's notes. */
    loadBoardHintsAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await getBoardHints();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          state.hints = action.payload;
        },
      },
    ),

    /** "Biryani khatam": the dish is off the menu now. */
    soldOutDishAsync: create.asyncThunk(
      async (itemId: string, { dispatch, rejectWithValue }) => {
        try {
          await setAvailability({ items: [{ itemId, isAvailable: false }] });
          void dispatch(loadBoardHintsAsync());
          return itemId;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.switching = true;
          state.actionError = NO_ERROR;
        },
        fulfilled: state => {
          state.switching = false;
        },
        rejected: (state, action) => {
          state.switching = false;
          state.actionError = readRejection(action, "The dish didn't switch off.");
        },
      },
    ),

    /** What to say out loud for a new order (spoken by the screen, after the chime). */
    announceOrderAsync: create.asyncThunk(
      async ({ id, language }: { id: string; language: 'ur' | 'en' }, { rejectWithValue }) => {
        try {
          return await getAnnouncement(id, language);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          if (!state.announced.includes(action.meta.arg.id)) state.announced.push(action.meta.arg.id);
        },
      },
    ),

    acceptOrderAsync: create.asyncThunk(
      async ({ id, eta }: { id: string; eta: number }, { dispatch, rejectWithValue }) => {
        try {
          const o = await acceptOrder(id, eta);
          // Accepting takes its recipes from stock: the tickets' stock notes change.
          void dispatch(loadBoardHintsAsync());
          return o;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busyId = action.meta.arg.id;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busyId = null;
          state.acceptFor = null;
          upsert(state, cardOfOrder(action.payload, state.cards.find(c => c.id === action.payload.id)));
        },
        rejected: (state, action) => {
          state.busyId = null;
          state.actionError = readRejection(action, "We couldn't accept it.");
        },
      },
    ),

    rejectOrderAsync: create.asyncThunk(
      async ({ id, reason }: { id: string; reason: string }, { dispatch, rejectWithValue }) => {
        try {
          const o = await rejectOrder(id, reason);
          void dispatch(loadBoardHintsAsync());
          return o;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busyId = action.meta.arg.id;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busyId = null;
          state.rejectFor = null;
          upsert(state, cardOfOrder(action.payload, undefined));
        },
        rejected: (state, action) => {
          state.busyId = null;
          state.actionError = readRejection(action, "We couldn't decline it.");
        },
      },
    ),

    moveOrderAsync: create.asyncThunk(
      async ({ id, move }: { id: string; move: BoardMove }, { rejectWithValue }) => {
        try {
          return await MOVES[move](id);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busyId = action.meta.arg.id;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busyId = null;
          upsert(state, cardOfOrder(action.payload, state.cards.find(c => c.id === action.payload.id)));
        },
        rejected: (state, action) => {
          state.busyId = null;
          state.actionError = readRejection(action, "That didn't go through.");
        },
      },
    ),

    // ── The kitchen's switches ──
    loadKitchenAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await getVendorProfile();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          state.profile = action.payload;
        },
      },
    ),
    switchKitchenAsync: create.asyncThunk(
      async (to: { pause: string | null; reason?: PauseReason | null; resumeAt?: string | null } | { resume: true } | { busy: number }, { rejectWithValue }) => {
        try {
          if ('resume' in to) return await resumeOrders();
          if ('busy' in to) return await setBusy(to.busy, to.busy ? new Date(Date.now() + 60 * 60_000).toISOString() : null);
          return await pauseOrders(to.pause, { reason: to.reason, resumeAt: to.resumeAt });
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.switching = true;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.switching = false;
          state.pauseOpen = false;
          state.profile = action.payload;
        },
        rejected: (state, action) => {
          state.switching = false;
          state.actionError = readRejection(action, "That didn't change.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorBoard: state => state,
    /** New orders still waiting for an answer. */
    selectNewOrderCount: state => state.cards.filter(c => c.status === 'placed').length,
    /** New orders nobody has opened yet (the alert rings while there are any). */
    selectUnseenCount: state => state.cards.filter(c => c.status === 'placed' && !state.seen.includes(c.id)).length,
  },
});

export const {
  setBoardColumn,
  markOrderSeen,
  openAccept,
  openReject,
  openPause,
  boardSynced,
  boardNewOrder,
  boardOrderUpdated,
  loadBoardAsync,
  acceptOrderAsync,
  rejectOrderAsync,
  moveOrderAsync,
  loadKitchenAsync,
  switchKitchenAsync,
  loadBoardHintsAsync,
  soldOutDishAsync,
  announceOrderAsync,
} = vendorBoardSlice.actions;
export const { selectVendorBoard, selectNewOrderCount, selectUnseenCount } = vendorBoardSlice.selectors;
