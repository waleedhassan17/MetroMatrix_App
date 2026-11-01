// MetroMatrix — My Kitchen: the pantry. What is in, what to use soon, adding
// (a form, a voice draft, a Shopping order), using up, throwing away,
// reminders, and the month's numbers.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import {
  addFromShoppingOrder,
  addPantryItem,
  addPantryItems,
  fetchExpiringPantry,
  fetchPantryReminders,
  fetchPantryStats,
  fetchGroceryOrders,
  fetchPantry,
  discardPantryItem,
  savePantryReminders,
  markPantryUsed,
} from '../../networks/myKitchen/pantry';
import { toRejectedValue } from '../../networks/network/network';
import { emptyPantryForm, type PantryForm } from '../../models/myKitchen/pantryModel';
import type { GroceryOrder, PantryLineInput, PantryList, PantryReminders, PantrySegment, PantryStats } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { pantryListSerializer, pantryStatsSerializer, pantryRemindersSerializer, pantryItemsSerializer, pantryUsedUpSerializer, groceryOrdersSerializer } from '../../serializers/myKitchen/myKitchenSerializer';

export interface PantrySliceState {
  segment: PantrySegment;
  list: PantryList | null;
  stats: PantryStats | null;
  reminders: PantryReminders | null;
  status: FormStatus;
  error: ServerError;
  form: PantryForm;
  formOpen: boolean;
  saving: boolean;
  actionError: ServerError;
  orders: GroceryOrder[];
  ordersStatus: FormStatus;
  acting: string | null;
  /** What the last add put in the pantry (by hand, by voice or from an order). */
  added: ReturnType<typeof pantryItemsSerializer>;
  /** The last item marked used. */
  usedUp: ReturnType<typeof pantryUsedUpSerializer> | null;
}

const initialState: PantrySliceState = {
  segment: 'all',
  list: null,
  stats: null,
  reminders: null,
  status: 'idle',
  error: NO_ERROR,
  form: emptyPantryForm(),
  formOpen: false,
  saving: false,
  actionError: NO_ERROR,
  orders: [],
  ordersStatus: 'idle',
  acting: null,
  added: [],
  usedUp: null,
};

export const pantrySlice = createAppSlice({
  name: 'pantry',
  initialState,
  reducers: create => ({
    setPantrySegment: create.reducer((state, action: PayloadAction<PantrySegment>) => {
      state.segment = action.payload;
    }),
    openPantryForm: create.reducer((state, action: PayloadAction<boolean>) => {
      state.formOpen = action.payload;
      state.actionError = NO_ERROR;
      if (action.payload) state.form = emptyPantryForm();
    }),
    setPantryField: create.reducer((state, action: PayloadAction<Partial<PantryForm>>) => {
      state.form = { ...state.form, ...action.payload };
    }),
    loadPantryAsync: create.asyncThunk(
      async (segment: PantrySegment, { rejectWithValue }) => {
        try {
          // What is in it, what expires soon and what has expired (the tabs' counts), the month's numbers, reminders.
          const [active, expiring, expired, stats, reminders] = await Promise.all([fetchPantry('active'), fetchExpiringPantry(), fetchPantry('expired'), fetchPantryStats(), fetchPantryReminders()]);
          return { items: segment === 'use_soon' ? expiring : segment === 'expired' ? expired : active, active, expiring, expired, stats, reminders };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = { list: pantryListSerializer(action.payload), stats: pantryStatsSerializer(action.payload), reminders: pantryRemindersSerializer(action.payload.reminders) };
          state.status = 'succeeded';
          state.list = payload.list;
          state.stats = payload.stats;
          state.reminders = payload.reminders;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your kitchen didn't load.");
        },
      },
    ),
    /** From the form or a voice draft. */
    addPantryAsync: create.asyncThunk(
      async ({ lines }: { lines: PantryLineInput[]; source: 'manual' | 'voice' }, { rejectWithValue }) => {
        try {
          return await (lines.length === 1 ? addPantryItem(lines[0]) : addPantryItems(lines));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = pantryItemsSerializer(action.payload);
          state.saving = false;
          state.formOpen = false;
          state.added = payload;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.actionError = readRejection(action, "That wasn't added.");
        },
      },
    ),
    markUsedAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return await markPantryUsed(id);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.acting = action.meta.arg;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = pantryUsedUpSerializer(action.payload);
          state.acting = null;
          if (state.list) state.list.items = state.list.items.filter(i => i.id !== action.meta.arg);
          state.usedUp = payload;
        },
        rejected: (state, action) => {
          state.acting = null;
          state.actionError = readRejection(action, "That didn't save.");
        },
      },
    ),
    throwAwayAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          // Thrown away: it counts as waste (a mistake is deleted from its own row).
          return await discardPantryItem(id);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.acting = action.meta.arg;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.acting = null;
          if (state.list) state.list.items = state.list.items.filter(i => i.id !== action.meta.arg);
        },
        rejected: (state, action) => {
          state.acting = null;
          state.actionError = readRejection(action, "That didn't save.");
        },
      },
    ),
    loadGroceryOrdersAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await fetchGroceryOrders();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.ordersStatus = 'loading';
        },
        fulfilled: (state, action) => {
          const payload = groceryOrdersSerializer(action.payload);
          state.ordersStatus = 'succeeded';
          state.orders = payload;
        },
        rejected: (state, action) => {
          state.ordersStatus = 'failed';
          state.actionError = readRejection(action, "Your orders didn't load.");
        },
      },
    ),
    addFromOrderAsync: create.asyncThunk(
      async ({ lineIds }: { orderId: string; lineIds: string[] }, { getState, rejectWithValue }) => {
        const orders = (getState() as { pantry: PantrySliceState }).pantry.orders;
        const lines = orders.flatMap(o => o.lines).filter(l => lineIds.includes(l.lineId));
        try {
          return await addFromShoppingOrder(lines.map(l => ({ storeOrderItemId: l.lineId, expiresOn: l.suggestedExpiresOn })));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.acting = action.meta.arg.orderId;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = pantryItemsSerializer(action.payload);
          state.acting = null;
          state.added = payload;
        },
        rejected: (state, action) => {
          state.acting = null;
          state.actionError = readRejection(action, "Those weren't added.");
        },
      },
    ),
    saveRemindersAsync: create.asyncThunk(
      async (patch: Partial<PantryReminders>, { rejectWithValue }) => {
        try {
          return await savePantryReminders(patch);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          const payload = pantryRemindersSerializer(action.payload);
          state.reminders = payload;
        },
        rejected: (state, action) => {
          state.actionError = readRejection(action, "That didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectPantry: state => state,
  },
});

export const {
  setPantrySegment,
  openPantryForm,
  setPantryField,
  loadPantryAsync,
  addPantryAsync,
  markUsedAsync,
  throwAwayAsync,
  loadGroceryOrdersAsync,
  addFromOrderAsync,
  saveRemindersAsync,
} = pantrySlice.actions;
export const { selectPantry } = pantrySlice.selectors;
