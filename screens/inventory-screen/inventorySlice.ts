// ═══════════════════════════════════════════════════════
// MetroMatrix — Inventory slice (stock per variant)
// ═══════════════════════════════════════════════════════
// Typed stock is a draft per row until saved; rows can be picked for a bulk
// "set to N"; a row's history (orders, cancels, restocks) opens in a sheet.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { bulkSetStock, fetchMovements, setStock } from '../../networks/shopping/partner/inventory';
import { toRejectedValue, required } from '../../networks/network/network';
import type { InventoryMovement, InventoryRow } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { inventoryRowSerializer, inventoryRowListSerializer, movementListSerializer } from '../../serializers/shopping/partnerSerializer';

export interface InventorySliceState {
  query: string;
  lowOnly: boolean;
  drafts: Record<string, string>;
  /** Rows saved since the list loaded (the list shows these). */
  saved: Record<string, InventoryRow>;
  selecting: boolean;
  selected: string[];
  bulkStock: string;
  busy: string | null;
  error: ServerError;
  history: { variantId: string | null; label: string; movements: InventoryMovement[]; status: FormStatus };
}

const initialState: InventorySliceState = {
  query: '',
  lowOnly: false,
  drafts: {},
  saved: {},
  selecting: false,
  selected: [],
  bulkStock: '',
  busy: null,
  error: NO_ERROR,
  history: { variantId: null, label: '', movements: [], status: 'idle' },
};

export const inventorySlice = createAppSlice({
  name: 'inventory',
  initialState,
  reducers: create => ({
    setInventoryQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.query = action.payload;
    }),
    setLowOnly: create.reducer((state, action: PayloadAction<boolean>) => {
      state.lowOnly = action.payload;
    }),
    setStockDraft: create.reducer((state, action: PayloadAction<{ variantId: string; value: string }>) => {
      state.drafts[action.payload.variantId] = action.payload.value.replace(/\D/g, '').slice(0, 6);
    }),
    toggleSelecting: create.reducer(state => {
      state.selecting = !state.selecting;
      state.selected = [];
    }),
    toggleSelected: create.reducer((state, action: PayloadAction<string>) => {
      const id = action.payload;
      state.selected = state.selected.includes(id) ? state.selected.filter(x => x !== id) : [...state.selected, id];
    }),
    setBulkStock: create.reducer((state, action: PayloadAction<string>) => {
      state.bulkStock = action.payload.replace(/\D/g, '').slice(0, 6);
    }),
    closeHistory: create.reducer(state => {
      state.history.variantId = null;
    }),

    saveStockAsync: create.asyncThunk(
      async ({ variantId, stock }: { variantId: string; stock: number }, { rejectWithValue }) => {
        try {
          return required(inventoryRowSerializer(await setStock(variantId, stock)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busy = action.meta.arg.variantId;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = null;
          state.saved[action.payload.variantId] = action.payload;
          delete state.drafts[action.payload.variantId];
        },
        rejected: (state, action) => {
          state.busy = null;
          state.error = readRejection(action, "We couldn't save that stock.");
        },
      },
    ),

    bulkStockAsync: create.asyncThunk(
      async ({ variantIds, stock }: { variantIds: string[]; stock: number }, { rejectWithValue }) => {
        try {
          return required(inventoryRowListSerializer(await bulkSetStock(variantIds, stock)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = 'bulk';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = null;
          for (const row of action.payload) {
            state.saved[row.variantId] = row;
            delete state.drafts[row.variantId];
          }
          state.selecting = false;
          state.selected = [];
          state.bulkStock = '';
        },
        rejected: (state, action) => {
          state.busy = null;
          state.error = readRejection(action, "We couldn't update those rows.");
        },
      },
    ),

    loadHistoryAsync: create.asyncThunk(
      async ({ variantId }: { variantId: string; label: string }, { rejectWithValue }) => {
        try {
          return required(movementListSerializer(await fetchMovements(variantId)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.history = { variantId: action.meta.arg.variantId, label: action.meta.arg.label, movements: [], status: 'loading' };
        },
        fulfilled: (state, action) => {
          if (state.history.variantId !== action.meta.arg.variantId) return;
          state.history.movements = action.payload;
          state.history.status = 'succeeded';
        },
        rejected: state => {
          state.history.status = 'failed';
        },
      },
    ),
  }),
  selectors: {
    selectInventory: state => state,
  },
});

export const {
  setInventoryQuery,
  setLowOnly,
  setStockDraft,
  toggleSelecting,
  toggleSelected,
  setBulkStock,
  closeHistory,
  saveStockAsync,
  bulkStockAsync,
  loadHistoryAsync,
} = inventorySlice.actions;
export const { selectInventory } = inventorySlice.selectors;
