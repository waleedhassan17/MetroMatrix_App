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
import { createAppSlice } from '../../store/createAppSlice';
import { acceptOrder, handedExternal, fetchBoard, markCollected, markDelivered, markReady, rejectOrder, startPreparing } from '../../networks/food/vendor/orders';
import { fetchVendorProfile, pauseOrders, resumeOrders, setBusy } from '../../networks/food/vendor/profile';
import { setAvailability } from '../../networks/food/vendor/availability';
import { fetchBoardHints } from '../../networks/kitchen/costing';
import { fetchAnnouncement } from '../../networks/kitchen/packing';
import { toRejectedValue, required } from '../../networks/network/network';
import { cardOfOrder, columnOf, isEnded, type BoardColumn } from '../../models/food/foodStatusModel';
import type { BoardCard, BoardHints, FoodLiveBoardUpdate, PauseReason, VendorProfile } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { vendorFoodOrderSerializer, boardPageSerializer } from '../../serializers/food/orderSerializer';
import { vendorProfileSerializer } from '../../serializers/food/vendorSerializer';
import { boardHintsSerializer, announcementSerializer } from '../../serializers/kitchen/insightSerializer';

export type BoardMove = 'preparing' | 'ready' | 'handed-external' | 'picked-up' | 'delivered';

export interface VendorBoardSliceState {
  /** The last order announcement read, for the screen to speak. */
  announcement: ReturnType<typeof announcementSerializer>;
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
  announcement: null,
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

type VendorOrderMove = (id: string) => Promise<NonNullable<ReturnType<typeof vendorFoodOrderSerializer>>>;

/** Each card move: its thin call, then the order serialized. */
const MOVES: Record<BoardMove, VendorOrderMove> = {
  preparing: async id => required(vendorFoodOrderSerializer(await startPreparing(id))),
  ready: async id => required(vendorFoodOrderSerializer(await markReady(id))),
  'handed-external': async id => required(vendorFoodOrderSerializer(await handedExternal(id))),
  'picked-up': async id => required(vendorFoodOrderSerializer(await markCollected(id))),
  delivered: async id => required(vendorFoodOrderSerializer(await markDelivered(id, null))),
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
          const [fresh, active] = await Promise.all([fetchBoard('new'), fetchBoard('active')]);
          // Every board read reads the kitchen's side too.
          void dispatch(loadBoardHintsAsync());
          return { fresh, active };
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
          const cards = [...boardPageSerializer(action.payload.fresh).items, ...boardPageSerializer(action.payload.active).items];
          state.status = 'succeeded';
          state.cards = cards.filter(c => !!columnOf(c.status)).sort(byAge);
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
          return await fetchBoardHints();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          const payload = boardHintsSerializer(action.payload);
          state.hints = payload;
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
          return await fetchAnnouncement(id, language);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          if (!state.announced.includes(action.meta.arg.id)) state.announced.push(action.meta.arg.id);
        },
        fulfilled: (state, action) => {
          state.announcement = announcementSerializer(action.payload);
        },
      },
    ),

    acceptOrderAsync: create.asyncThunk(
      async ({ id, eta }: { id: string; eta: number }, { dispatch, rejectWithValue }) => {
        try {
          const accepted = await acceptOrder(id, eta);
          // Accepting takes its recipes from stock: the tickets' stock notes change.
          void dispatch(loadBoardHintsAsync());
          return accepted;
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
          const order = vendorFoodOrderSerializer(action.payload);
          state.busyId = null;
          state.acceptFor = null;
          if (order) upsert(state, cardOfOrder(order, state.cards.find(c => c.id === order.id)));
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
          const rejected = await rejectOrder(id, reason);
          void dispatch(loadBoardHintsAsync());
          return rejected;
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
          const order = vendorFoodOrderSerializer(action.payload);
          state.busyId = null;
          state.rejectFor = null;
          if (order) upsert(state, cardOfOrder(order, undefined));
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
          return await fetchVendorProfile();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          const payload = vendorProfileSerializer(action.payload);
          state.profile = payload;
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
          const profile = vendorProfileSerializer(action.payload);
          state.switching = false;
          state.pauseOpen = false;
          if (profile) state.profile = profile;
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
