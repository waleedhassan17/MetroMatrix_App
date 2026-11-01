// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: city prices slice
// ═══════════════════════════════════════════════════════
// The PBS items Price watch compares a kitchen's purchases with (in how many
// cities, the latest week loaded), and the CSV import: a dry run, then the import.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchReferenceItems, importReferencePrices } from '../../networks/admin/adminKitchen';
import { toRejectedValue } from '../../networks/network/network';
import type { CsvImportResult, ReferenceItem } from '../../models';
import {
  NO_ERROR,
  readRejection,
  type FormStatus,
  type ServerError,
} from '../shared/formStatus';
import { referenceItemsSerializer, priceImportSerializer } from '../../serializers/kitchen/adminKitchenSerializer';

export interface AdminKitchenPricesSliceState {
  q: string;
  list: ReferenceItem[] | null;
  status: FormStatus;
  error: ServerError;
  csv: string;
  fileName: string | null;
  result: CsvImportResult | null;
  checking: boolean;
  importing: boolean;
  importError: ServerError;
}

const initialState: AdminKitchenPricesSliceState = {
  q: '',
  list: null,
  status: 'idle',
  error: NO_ERROR,
  csv: '',
  fileName: null,
  result: null,
  checking: false,
  importing: false,
  importError: NO_ERROR,
};

export const adminKitchenPricesSlice = createAppSlice({
  name: 'adminKitchenPrices',
  initialState,
  reducers: create => ({
    setPricesFilter: create.reducer((state, action: PayloadAction<{ q?: string }>) => {
      if (action.payload.q !== undefined) state.q = action.payload.q;
    }),
    setPricesCsv: create.reducer((state, action: PayloadAction<{ csv: string; fileName?: string | null }>) => {
      state.csv = action.payload.csv;
      if (action.payload.fileName !== undefined) state.fileName = action.payload.fileName;
      // A changed file needs a new dry run.
      state.result = null;
      state.importError = NO_ERROR;
    }),
    setPricesImportError: create.reducer((state, action: PayloadAction<string>) => {
      state.importError = { ...NO_ERROR, message: action.payload };
    }),

    loadPricesAsync: create.asyncThunk(
      async (q: { q?: string }, { rejectWithValue }) => {
        try {
          return await fetchReferenceItems(q.q ?? '');
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
          state.list = referenceItemsSerializer(action.payload);
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The city prices didn't load.");
        },
      },
    ),

    checkPricesCsvAsync: create.asyncThunk(
      async (csv: string, { rejectWithValue }) => {
        try {
          return await importReferencePrices(csv, true);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.checking = true;
          state.importError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = priceImportSerializer(action.payload);
          state.checking = false;
          state.result = payload;
        },
        rejected: (state, action) => {
          state.checking = false;
          state.importError = readRejection(action, "The file couldn't be checked.");
        },
      },
    ),

    importPricesCsvAsync: create.asyncThunk(
      async (input: { csv: string }, { rejectWithValue }) => {
        try {
          const result = await importReferencePrices(input.csv, false);
          return { result, list: await fetchReferenceItems() };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.importing = true;
          state.importError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.importing = false;
          state.result = priceImportSerializer(action.payload.result);
          state.list = referenceItemsSerializer(action.payload.list);
          state.q = '';
          state.csv = '';
          state.fileName = null;
        },
        rejected: (state, action) => {
          state.importing = false;
          state.importError = readRejection(action, 'Nothing was imported.');
        },
      },
    ),
  }),
  selectors: {
    selectAdminKitchenPrices: state => state,
  },
});

export const {
  setPricesFilter,
  setPricesCsv,
  setPricesImportError,
  loadPricesAsync,
  checkPricesCsvAsync,
  importPricesCsvAsync,
} = adminKitchenPricesSlice.actions;
export const { selectAdminKitchenPrices } = adminKitchenPricesSlice.selectors;
