// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: words slice
// ═══════════════════════════════════════════════════════
// The words voice and receipt scans understand for each ingredient (Roman
// Urdu, Urdu, English): a search, the sheet that adds one with its
// ingredient picked from a search, and deleting one.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { createAlias, deleteAlias, fetchAliases, fetchIngredientKeys } from '../../networks/admin/adminKitchen';
import { toRejectedValue, required } from '../../networks/network/network';
import { emptyAliasForm, type AliasForm } from '../../models/kitchen/adminKitchenModel';
import type { IngredientAlias, IngredientKey } from '../../models';
import {
  NO_ERROR,
  readRejection,
  type FormStatus,
  type ServerError,
} from '../shared/formStatus';
import { aliasesSerializer, ingredientKeysSerializer, aliasSerializer } from '../../serializers/kitchen/adminKitchenSerializer';

export interface AdminKitchenAliasesSliceState {
  q: string;
  items: IngredientAlias[];
  total: number;
  status: FormStatus;
  error: ServerError;
  sheet: AliasForm | null;
  keyQuery: string;
  keys: IngredientKey[];
  submitted: boolean;
  busy: boolean;
  saveError: ServerError;
}

const initialState: AdminKitchenAliasesSliceState = {
  q: '',
  items: [],
  total: 0,
  status: 'idle',
  error: NO_ERROR,
  sheet: null,
  keyQuery: '',
  keys: [],
  submitted: false,
  busy: false,
  saveError: NO_ERROR,
};

export const adminKitchenAliasesSlice = createAppSlice({
  name: 'adminKitchenAliases',
  initialState,
  reducers: create => ({
    setAliasesQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.q = action.payload;
    }),
    openAliasSheet: create.reducer((state, action: PayloadAction<boolean>) => {
      state.sheet = action.payload ? emptyAliasForm() : null;
      state.keyQuery = '';
      state.keys = [];
      state.submitted = false;
      state.saveError = NO_ERROR;
    }),
    setAliasForm: create.reducer((state, action: PayloadAction<Partial<AliasForm>>) => {
      if (state.sheet) state.sheet = { ...state.sheet, ...action.payload };
    }),
    setKeyQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.keyQuery = action.payload;
    }),
    markAliasSubmitted: create.reducer(state => {
      state.submitted = true;
    }),

    loadAliasesAsync: create.asyncThunk(
      async (q: string, { rejectWithValue }) => {
        try {
          return required(aliasesSerializer(await fetchAliases(q.trim() || undefined)));
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
          state.error = readRejection(action, "The words didn't load.");
        },
      },
    ),

    searchKeysAsync: create.asyncThunk(
      async (q: string, { rejectWithValue }) => {
        try {
          return required(ingredientKeysSerializer(await fetchIngredientKeys(q.trim() || undefined)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          state.keys = action.payload;
        },
      },
    ),

    saveAliasAsync: create.asyncThunk(
      async (input: { form: AliasForm; q: string }, { rejectWithValue }) => {
        try {
          const a = required(aliasSerializer(await createAlias({ word: input.form.word, language: input.form.language, key: input.form.key })));
          return { alias: a, list: required(aliasesSerializer(await fetchAliases(input.q.trim() || undefined))) };
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
          state.items = action.payload.list.items;
          state.total = action.payload.list.total;
        },
        rejected: (state, action) => {
          state.busy = false;
          state.saveError = readRejection(action, "That didn't save.");
        },
      },
    ),

    deleteAliasAsync: create.asyncThunk(
      async (input: { id: string; q: string }, { rejectWithValue }) => {
        try {
          await deleteAlias(input.id);
          return required(aliasesSerializer(await fetchAliases(input.q.trim() || undefined)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = false;
          state.items = action.payload.items;
          state.total = action.payload.total;
        },
        rejected: (state, action) => {
          state.busy = false;
          state.error = readRejection(action, "That word wasn't deleted.");
        },
      },
    ),
  }),
  selectors: {
    selectAdminKitchenAliases: state => state,
  },
});

export const {
  setAliasesQuery,
  openAliasSheet,
  setAliasForm,
  setKeyQuery,
  markAliasSubmitted,
  loadAliasesAsync,
  searchKeysAsync,
  saveAliasAsync,
  deleteAliasAsync,
} = adminKitchenAliasesSlice.actions;
export const { selectAdminKitchenAliases } = adminKitchenAliasesSlice.selectors;
