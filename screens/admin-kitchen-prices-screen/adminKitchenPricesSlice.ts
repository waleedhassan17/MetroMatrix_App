// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: city prices slice
// ═══════════════════════════════════════════════════════
// A city's latest week of reference prices (what Price watch compares a
// kitchen's purchases with), and the CSV import: a dry run, then the import.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchReferencePrices, importReferencePrices } from '../../networks/admin/adminKitchen';
import { toRejectedValue } from '../../networks/network/network';
import type { CsvImportResult, PriceImportRow, ReferencePriceList } from '../../models';
import {
  NO_ERROR,
  readRejection,
  type FormStatus,
  type ServerError,
} from '../shared/formStatus';
import { referencePricesSerializer, priceImportSerializer } from '../../serializers/kitchen/adminKitchenSerializer';

export interface AdminKitchenPricesSliceState {
  city: string | null;
  q: string;
  list: ReferencePriceList | null;
  status: FormStatus;
  error: ServerError;
  csv: string;
  fileName: string | null;
  result: CsvImportResult<PriceImportRow> | null;
  checking: boolean;
  importing: boolean;
  importError: ServerError;
}

const initialState: AdminKitchenPricesSliceState = {
  city: null,
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
    setPricesFilter: create.reducer((state, action: PayloadAction<{ city?: string; q?: string }>) => {
      if (action.payload.city !== undefined) state.city = action.payload.city;
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
      async (q: { city?: string | null; q?: string }, { rejectWithValue }) => {
        try {
          return await fetchReferencePrices({ city: q.city ?? undefined, q: q.q?.trim() || undefined });
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
          const payload = referencePricesSerializer(action.payload);
          state.status = 'succeeded';
          state.list = payload;
          state.city = payload.city;
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
      async (input: { csv: string; city: string | null }, { rejectWithValue }) => {
        try {
          const result = await importReferencePrices(input.csv, false);
          return { result, list: await fetchReferencePrices({ city: input.city ?? undefined }) };
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
          state.list = referencePricesSerializer(action.payload.list);
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
