// MetroMatrix — My Kitchen: the pantry. What is in, what to use soon, adding
// (a form, a voice draft, a Shopping order), using up, throwing away,
// reminders, and the month's numbers.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../store/createAppSlice';
import {
  addFromShoppingOrderAPI,
  addToPantryAPI,
  getPantryRemindersAPI,
  getPantryStatsAPI,
  getGroceryOrdersAPI,
  getPantryAPI,
  removePantryItemAPI,
  savePantryRemindersAPI,
  markPantryUsedAPI,
} from '../../../networks/myKitchen/pantryNetwork';
import { toRejectedValue, required } from '../../../networks/network/apiHelpers';
import { emptyPantryForm, type PantryForm } from '../../../models/myKitchen/pantryModel';
import type { GroceryOrder, PantryLineInput, PantryList, PantryReminders, PantrySegment, PantryStats } from '../../../types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../Auth/shared/formStatus';
import { pantryListSerializer, pantryStatsSerializer, pantryRemindersSerializer, pantryItemsSerializer, pantryUsedUpSerializer, pantryRemovedSerializer, groceryOrdersSerializer } from '../../../serializers/myKitchen/myKitchenSerializer';

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
          const [list, stats, reminders] = await Promise.all([getPantryAPI(segment).then(raw => required(pantryListSerializer(raw))), getPantryStatsAPI().then(raw => required(pantryStatsSerializer(raw))), getPantryRemindersAPI().then(raw => required(pantryRemindersSerializer(raw)))]);
          return { list, stats, reminders };
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
          state.status = 'succeeded';
          state.list = action.payload.list;
          state.stats = action.payload.stats;
          state.reminders = action.payload.reminders;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your kitchen didn't load.");
        },
      },
    ),
    /** From the form or a voice draft. */
    addPantryAsync: create.asyncThunk(
      async ({ lines, source }: { lines: PantryLineInput[]; source: 'manual' | 'voice' }, { rejectWithValue }) => {
        try {
          return required(pantryItemsSerializer(await addToPantryAPI(lines, source)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
          state.actionError = NO_ERROR;
        },
        fulfilled: state => {
          state.saving = false;
          state.formOpen = false;
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
          return required(pantryUsedUpSerializer(await markPantryUsedAPI(id)));
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
    throwAwayAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return required(pantryRemovedSerializer(await removePantryItemAPI(id)));
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
          return required(groceryOrdersSerializer(await getGroceryOrdersAPI()));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.ordersStatus = 'loading';
        },
        fulfilled: (state, action) => {
          state.ordersStatus = 'succeeded';
          state.orders = action.payload;
        },
        rejected: (state, action) => {
          state.ordersStatus = 'failed';
          state.actionError = readRejection(action, "Your orders didn't load.");
        },
      },
    ),
    addFromOrderAsync: create.asyncThunk(
      async ({ orderId, lineIds }: { orderId: string; lineIds: string[] }, { rejectWithValue }) => {
        try {
          return required(pantryItemsSerializer(await addFromShoppingOrderAPI(orderId, lineIds)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.acting = action.meta.arg.orderId;
          state.actionError = NO_ERROR;
        },
        fulfilled: state => {
          state.acting = null;
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
          return required(pantryRemindersSerializer(await savePantryRemindersAPI(patch)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          state.reminders = action.payload;
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
