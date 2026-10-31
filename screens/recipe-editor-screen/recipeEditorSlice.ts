// MetroMatrix — Kitchen: a dish's recipe card for one size. The saved card,
// the kitchen's ingredients (to pick from and to cost with), and the draft
// the cook edits: servings it makes, ingredient lines, add-ons, packaging,
// the signature mark. Lines are kept as typed; the model converts them.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { deleteRecipe, fetchRecipe, saveRecipe } from '../../networks/kitchen/recipes';
import { fetchStock } from '../../networks/kitchen/stock';
import { toRejectedValue, required } from '../../networks/network/network';
import { editableAmount } from '../../models/kitchen/stockModel';
import { newLineKey } from '../../models/kitchen/purchaseModel';
import type { DraftLine, RecipeDraft } from '../../models/kitchen/costingModel';
import type { Ingredient, Recipe, RecipeInput, RecipeLine } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { recipeSerializer } from '../../serializers/kitchen/recipeSerializer';
import { stockListSerializer } from '../../serializers/kitchen/stockSerializer';

/** Where a picked ingredient goes: the lines, packaging, or one add-on. */
export type LineSection = 'lines' | 'packaging' | `addon:${string}`;

export interface RecipeEditorSliceState {
  itemId: string | null;
  variantId: string | null;
  recipe: Recipe | null;
  ingredients: Ingredient[];
  draft: RecipeDraft;
  dirty: boolean;
  lineErrors: Record<string, string>;
  touched: boolean;
  status: FormStatus;
  saving: boolean;
  error: ServerError;
}

const EMPTY_DRAFT: RecipeDraft = { yield: '1', lines: [], packaging: [], addOns: {}, signatureOn: false, creatorName: '' };

const initialState: RecipeEditorSliceState = {
  itemId: null,
  variantId: null,
  recipe: null,
  ingredients: [],
  draft: EMPTY_DRAFT,
  dirty: false,
  lineErrors: {},
  touched: false,
  status: 'idle',
  saving: false,
  error: NO_ERROR,
};

const draftLine = (l: RecipeLine): DraftLine => {
  const e = editableAmount(l, l.qty);
  return { key: newLineKey(), ingredientId: l.ingredientId, amount: e.amount, unitKey: e.unitKey };
};

const draftOf = (r: Recipe): RecipeDraft => ({
  yield: String(r.yield),
  lines: r.lines.map(draftLine),
  packaging: r.packaging.map(draftLine),
  addOns: Object.fromEntries(r.addOns.map(a => [a.optionId, a.lines.map(draftLine)])),
  signatureOn: r.signature.on,
  creatorName: r.signature.creatorName ?? '',
});

const linesIn = (d: RecipeDraft, section: LineSection): DraftLine[] => {
  if (section === 'lines') return d.lines;
  if (section === 'packaging') return d.packaging;
  const id = section.slice('addon:'.length);
  d.addOns[id] = d.addOns[id] ?? [];
  return d.addOns[id];
};

export const recipeEditorSlice = createAppSlice({
  name: 'recipeEditor',
  initialState,
  reducers: create => ({
    setRecipeYield: create.reducer((state, action: PayloadAction<string>) => {
      state.draft.yield = action.payload.replace(/[^\d]/g, '').slice(0, 3);
      state.dirty = true;
    }),
    addRecipeLine: create.reducer((state, action: PayloadAction<{ section: LineSection; ingredient: Ingredient }>) => {
      const i = action.payload.ingredient;
      const unitKey = i.baseUnit === 'g' ? 'g' : i.baseUnit === 'ml' ? 'ml' : 'pc';
      linesIn(state.draft, action.payload.section).push({ key: newLineKey(), ingredientId: i.id, amount: '', unitKey });
      if (!state.ingredients.some(x => x.id === i.id)) state.ingredients.push(i);
      state.dirty = true;
    }),
    updateRecipeLine: create.reducer((state, action: PayloadAction<{ section: LineSection; key: string; patch: Partial<DraftLine> }>) => {
      const l = linesIn(state.draft, action.payload.section).find(x => x.key === action.payload.key);
      if (l) Object.assign(l, action.payload.patch);
      delete state.lineErrors[action.payload.key];
      state.dirty = true;
    }),
    removeRecipeLine: create.reducer((state, action: PayloadAction<{ section: LineSection; key: string }>) => {
      const list = linesIn(state.draft, action.payload.section);
      list.splice(
        list.findIndex(x => x.key === action.payload.key),
        1,
      );
      state.dirty = true;
    }),
    setSignature: create.reducer((state, action: PayloadAction<{ on?: boolean; creatorName?: string }>) => {
      if (action.payload.on !== undefined) state.draft.signatureOn = action.payload.on;
      if (action.payload.creatorName !== undefined) state.draft.creatorName = action.payload.creatorName.slice(0, 60);
      state.dirty = true;
    }),
    setRecipeLineErrors: create.reducer((state, action: PayloadAction<Record<string, string>>) => {
      state.lineErrors = action.payload;
      state.touched = true;
    }),
    loadRecipeEditorAsync: create.asyncThunk(
      async ({ itemId, variantId }: { itemId: string; variantId?: string | null }, { rejectWithValue }) => {
        try {
          const [recipe, stock] = await Promise.all([fetchRecipe(itemId, variantId).then(raw => required(recipeSerializer(raw))), fetchStock('all', '').then(raw => required(stockListSerializer(raw)))]);
          return { recipe, ingredients: stock.items };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.status = 'loading';
          state.error = NO_ERROR;
          if (state.itemId !== action.meta.arg.itemId) Object.assign(state, initialState, { status: 'loading' as FormStatus });
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.itemId = action.payload.recipe.itemId;
          state.variantId = action.payload.recipe.variantId;
          state.recipe = action.payload.recipe;
          state.ingredients = action.payload.ingredients;
          state.draft = draftOf(action.payload.recipe);
          state.dirty = false;
          state.lineErrors = {};
          state.touched = false;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "This recipe didn't load.");
        },
      },
    ),
    saveRecipeAsync: create.asyncThunk(
      async ({ itemId, variantId, input }: { itemId: string; variantId: string | null; input: RecipeInput }, { rejectWithValue }) => {
        try {
          return await saveRecipe(itemId, variantId, input);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = recipeSerializer(action.payload);
          state.saving = false;
          if (!payload) return;
          state.recipe = payload;
          state.draft = draftOf(payload);
          state.dirty = false;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "The recipe didn't save.");
        },
      },
    ),
    deleteRecipeAsync: create.asyncThunk(
      async ({ itemId, variantId }: { itemId: string; variantId: string | null }, { rejectWithValue }) => {
        try {
          return await deleteRecipe(itemId, variantId);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
        },
        fulfilled: (state, action) => {
          const payload = recipeSerializer(action.payload);
          state.saving = false;
          if (!payload) return;
          state.recipe = payload;
          state.draft = draftOf(payload);
          state.dirty = false;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "The recipe wasn't removed.");
        },
      },
    ),
  }),
  selectors: {
    selectRecipeEditor: state => state,
  },
});

export const {
  setRecipeYield,
  addRecipeLine,
  updateRecipeLine,
  removeRecipeLine,
  setSignature,
  setRecipeLineErrors,
  loadRecipeEditorAsync,
  saveRecipeAsync,
  deleteRecipeAsync,
} = recipeEditorSlice.actions;
export const { selectRecipeEditor } = recipeEditorSlice.selectors;
