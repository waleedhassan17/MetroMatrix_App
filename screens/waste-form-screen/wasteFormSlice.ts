// MetroMatrix — Kitchen: log waste. Ingredients (an amount in the cook's
// unit) or cooked dishes (servings), one reason for the lot, an optional
// note. Saving takes it out of stock at what it cost.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchStock } from '../../networks/kitchen/stock';
import { fetchRecipes } from '../../networks/kitchen/recipes';
import { logWaste } from '../../networks/kitchen/waste';
import { toRejectedValue, required } from '../../networks/network/network';
import { dishLine, ingredientLine, wasteDraftFromVoice, type WasteDraftLine } from '../../models/kitchen/wasteModel';
import type { Ingredient, VoiceQtyLine, WasteLineInput, WasteReason } from '../../models';
import type { ValidationErrors } from '../../models/authModel';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { stockListSerializer } from '../../serializers/kitchen/stockSerializer';
import { recipeListSerializer } from '../../serializers/kitchen/recipeSerializer';
import { wasteSerializer } from '../../serializers/kitchen/wasteSerializer';

export interface WasteFormSliceState {
  ingredients: Ingredient[];
  dishes: { itemId: string; name: string }[];
  status: FormStatus;
  error: ServerError;
  lines: WasteDraftLine[];
  reason: WasteReason;
  note: string;
  errors: ValidationErrors;
  lineErrors: Record<string, string>;
  saving: boolean;
  saveError: ServerError;
  /** The waste just logged. */
  saved: ReturnType<typeof wasteSerializer>;
}

const initialState: WasteFormSliceState = {
  ingredients: [],
  dishes: [],
  status: 'idle',
  error: NO_ERROR,
  lines: [],
  reason: 'spoiled',
  note: '',
  errors: {},
  lineErrors: {},
  saving: false,
  saveError: NO_ERROR,
  saved: null,
};

export const wasteFormSlice = createAppSlice({
  name: 'wasteForm',
  initialState,
  reducers: create => ({
    resetWasteForm: create.reducer(state => ({ ...initialState, ingredients: state.ingredients, dishes: state.dishes, status: state.status })),
    addWasteIngredient: create.reducer((state, action: PayloadAction<Ingredient>) => {
      state.lines.push(ingredientLine(action.payload));
      state.errors = {};
    }),
    addWasteDish: create.reducer((state, action: PayloadAction<{ itemId: string; name: string }>) => {
      state.lines.push(dishLine(action.payload));
      state.errors = {};
    }),
    updateWasteLine: create.reducer((state, action: PayloadAction<{ key: string; patch: Partial<Pick<WasteDraftLine, 'amount' | 'unitKey' | 'id' | 'name'>> }>) => {
      const l = state.lines.find(x => x.key === action.payload.key);
      if (l) Object.assign(l, action.payload.patch);
      delete state.lineErrors[action.payload.key];
    }),
    removeWasteLine: create.reducer((state, action: PayloadAction<string>) => {
      state.lines = state.lines.filter(l => l.key !== action.payload);
    }),
    setWasteReason: create.reducer((state, action: PayloadAction<WasteReason>) => {
      state.reason = action.payload;
    }),
    setWasteNote: create.reducer((state, action: PayloadAction<string>) => {
      state.note = action.payload;
    }),
    fillWasteFromVoice: create.reducer((state, action: PayloadAction<{ lines: VoiceQtyLine[]; reason: WasteReason }>) => {
      state.lines.push(...wasteDraftFromVoice(action.payload.lines, state.ingredients));
      state.reason = action.payload.reason;
      state.errors = {};
    }),
    setWasteErrors: create.reducer((state, action: PayloadAction<{ errors: ValidationErrors; lineErrors: Record<string, string> }>) => {
      state.errors = action.payload.errors;
      state.lineErrors = action.payload.lineErrors;
    }),

    loadWasteFormAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          const [stock, recipes] = await Promise.all([fetchStock('all', '').then(raw => required(stockListSerializer(raw))), fetchRecipes(false).then(raw => required(recipeListSerializer(raw)))]);
          const seen = new Set<string>();
          const dishes = recipes.items.filter(r => !seen.has(r.itemId) && seen.add(r.itemId)).map(r => ({ itemId: r.itemId, name: r.name }));
          return { ingredients: stock.items, dishes };
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
          state.ingredients = action.payload.ingredients;
          state.dishes = action.payload.dishes;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your stock didn't load.");
        },
      },
    ),

    saveWasteAsync: create.asyncThunk(
      async (input: WasteLineInput[], { getState, rejectWithValue }) => {
        const note = (getState() as { wasteForm: WasteFormSliceState }).wasteForm.note.trim();
        try {
          return await logWaste(input, note || undefined);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
          state.saveError = NO_ERROR;
          state.errors = {};
          state.lineErrors = {};
        },
        fulfilled: (state, action) => {
          const payload = wasteSerializer(action.payload);
          state.saving = false;
          state.saved = payload;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.saveError = readRejection(action, "The waste didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectWasteForm: state => state,
  },
});

export const { resetWasteForm, addWasteIngredient, addWasteDish, updateWasteLine, removeWasteLine, setWasteReason, setWasteNote, fillWasteFromVoice, setWasteErrors, loadWasteFormAsync, saveWasteAsync } = wasteFormSlice.actions;
export const { selectWasteForm } = wasteFormSlice.selectors;
