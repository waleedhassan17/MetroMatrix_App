// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: nutrition foods slice
// ═══════════════════════════════════════════════════════
// The reference foods dish numbers are worked out from (kitchens map their
// ingredients to them): a search, the sheet that adds or edits one, and
// the CSV import with its dry run.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import {
  createNutritionFoodAPI,
  importNutritionFoodsAPI,
  getNutritionFoodsAPI,
  updateNutritionFoodAPI,
} from '../../networks/admin/adminKitchenNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import {
  emptyNutritionFoodForm,
  foodKeyOf,
  nutritionFoodFormOf,
  nutritionFoodInputOf,
  type NutritionFoodForm,
} from '../../models/kitchen/adminKitchenModel';
import type { CsvImportResult, NutritionFoodImportRow, StaffNutritionFood } from '../../models';
import {
  NO_ERROR,
  readRejection,
  type FormStatus,
  type ServerError,
} from '../shared/formStatus';
import { staffNutritionFoodsSerializer, nutritionFoodImportSerializer } from '../../serializers/kitchen/adminKitchenSerializer';

export interface FoodSheet {
  /** '' for a new one. */
  id: string;
  form: NutritionFoodForm;
  /** The key follows the name until it is edited. */
  keyEdited: boolean;
}

export interface AdminKitchenNutritionSliceState {
  q: string;
  items: StaffNutritionFood[];
  total: number;
  status: FormStatus;
  error: ServerError;
  sheet: FoodSheet | null;
  submitted: boolean;
  busy: boolean;
  saveError: ServerError;
  csv: string;
  fileName: string | null;
  result: CsvImportResult<NutritionFoodImportRow> | null;
  checking: boolean;
  importing: boolean;
  importError: ServerError;
}

const initialState: AdminKitchenNutritionSliceState = {
  q: '',
  items: [],
  total: 0,
  status: 'idle',
  error: NO_ERROR,
  sheet: null,
  submitted: false,
  busy: false,
  saveError: NO_ERROR,
  csv: '',
  fileName: null,
  result: null,
  checking: false,
  importing: false,
  importError: NO_ERROR,
};

const PAGE = { page: 1, pageSize: 100 };

export const adminKitchenNutritionSlice = createAppSlice({
  name: 'adminKitchenNutrition',
  initialState,
  reducers: create => ({
    setFoodsQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.q = action.payload;
    }),
    openFoodSheet: create.reducer((state, action: PayloadAction<StaffNutritionFood | 'new' | null>) => {
      const f = action.payload;
      state.sheet = f === null ? null : f === 'new' ? { id: '', form: emptyNutritionFoodForm(), keyEdited: false } : { id: f.id, form: nutritionFoodFormOf(f), keyEdited: true };
      state.submitted = false;
      state.saveError = NO_ERROR;
    }),
    setFoodForm: create.reducer((state, action: PayloadAction<Partial<NutritionFoodForm>>) => {
      if (!state.sheet) return;
      const next = { ...state.sheet.form, ...action.payload };
      if (action.payload.key !== undefined) state.sheet.keyEdited = true;
      if (action.payload.name !== undefined && !state.sheet.keyEdited && !state.sheet.id) next.key = foodKeyOf(action.payload.name);
      state.sheet.form = next;
    }),
    markFoodSubmitted: create.reducer(state => {
      state.submitted = true;
    }),
    setFoodsCsv: create.reducer((state, action: PayloadAction<{ csv: string; fileName?: string | null }>) => {
      state.csv = action.payload.csv;
      if (action.payload.fileName !== undefined) state.fileName = action.payload.fileName;
      state.result = null;
      state.importError = NO_ERROR;
    }),
    setFoodsImportError: create.reducer((state, action: PayloadAction<string>) => {
      state.importError = { ...NO_ERROR, message: action.payload };
    }),

    loadFoodsAsync: create.asyncThunk(
      async (q: string, { rejectWithValue }) => {
        try {
          return required(staffNutritionFoodsSerializer(await getNutritionFoodsAPI({ q: q.trim() || undefined, ...PAGE })));
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
          state.items = action.payload.items;
          state.total = action.payload.total;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The nutrition foods didn't load.");
        },
      },
    ),

    saveFoodAsync: create.asyncThunk(
      async (input: { sheet: FoodSheet; q: string }, { rejectWithValue }) => {
        try {
          const body = nutritionFoodInputOf(input.sheet.form);
          if (input.sheet.id) await updateNutritionFoodAPI(input.sheet.id, body);
          else await createNutritionFoodAPI({ ...body, key: input.sheet.form.key.trim() });
          return required(staffNutritionFoodsSerializer(await getNutritionFoodsAPI({ q: input.q.trim() || undefined, ...PAGE })));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = true;
          state.saveError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = false;
          state.sheet = null;
          state.items = action.payload.items;
          state.total = action.payload.total;
        },
        rejected: (state, action) => {
          state.busy = false;
          state.saveError = readRejection(action, "That didn't save.");
        },
      },
    ),

    checkFoodsCsvAsync: create.asyncThunk(
      async (csv: string, { rejectWithValue }) => {
        try {
          return required(nutritionFoodImportSerializer(await importNutritionFoodsAPI(csv, true)));
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
          state.checking = false;
          state.result = action.payload;
        },
        rejected: (state, action) => {
          state.checking = false;
          state.importError = readRejection(action, "The file couldn't be checked.");
        },
      },
    ),

    importFoodsCsvAsync: create.asyncThunk(
      async (input: { csv: string; q: string }, { rejectWithValue }) => {
        try {
          const result = required(nutritionFoodImportSerializer(await importNutritionFoodsAPI(input.csv, false)));
          return { result, list: required(staffNutritionFoodsSerializer(await getNutritionFoodsAPI({ q: input.q.trim() || undefined, ...PAGE }))) };
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
          state.result = action.payload.result;
          state.items = action.payload.list.items;
          state.total = action.payload.list.total;
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
    selectAdminKitchenNutrition: state => state,
  },
});

export const {
  setFoodsQuery,
  openFoodSheet,
  setFoodForm,
  markFoodSubmitted,
  setFoodsCsv,
  setFoodsImportError,
  loadFoodsAsync,
  saveFoodAsync,
  checkFoodsCsvAsync,
  importFoodsCsvAsync,
} = adminKitchenNutritionSlice.actions;
export const { selectAdminKitchenNutrition } = adminKitchenNutritionSlice.selectors;
