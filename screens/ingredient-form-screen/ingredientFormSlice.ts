// MetroMatrix — Kitchen: adding or editing an ingredient (its name, kind,
// how it is counted, the level it is restocked at, the kitchen's own units).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { createIngredient, fetchIngredient, updateIngredient } from '../../networks/kitchen/stock';
import { toRejectedValue } from '../../networks/network/network';
import { customUnitRows, defaultUnit, type CustomUnitRow, type IngredientForm } from '../../models/kitchen/stockModel';
import type { IngredientDetail, IngredientInput } from '../../models';
import { UNITS, type BaseUnit } from '../../utils/units/units';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { ingredientDetailSerializer } from '../../serializers/kitchen/stockSerializer';

export interface IngredientFormSliceState {
  editingId: string | null;
  form: IngredientForm;
  customUnits: CustomUnitRow[];
  touched: boolean;
  status: FormStatus;
  saving: boolean;
  error: ServerError;
  /** Has stock: the way it is counted can't change. */
  locked: boolean;
  /** The ingredient just saved. */
  saved: ReturnType<typeof ingredientDetailSerializer>;
}

const EMPTY: IngredientForm = { name: '', category: 'vegetables', baseUnit: 'g', dozens: false, par: '', parUnit: 'kg' };

const initialState: IngredientFormSliceState = { editingId: null, form: EMPTY, customUnits: [], touched: false, status: 'idle', saving: false, error: NO_ERROR, locked: false ,
  saved: null,
};

const formOf = (i: IngredientDetail): IngredientForm => {
  const parUnit = defaultUnit(i);
  return {
    name: i.name,
    category: i.category,
    baseUnit: i.baseUnit,
    dozens: i.dozens,
    par: i.parLevel === null ? '' : String(i.parLevel / UNITS[parUnit].factor),
    parUnit,
  };
};

export const ingredientFormSlice = createAppSlice({
  name: 'ingredientForm',
  initialState,
  reducers: create => ({
    startIngredientForm: create.reducer((_state, action: PayloadAction<{ name?: string } | undefined>) => ({ ...initialState, form: { ...EMPTY, name: action.payload?.name ?? '' } })),
    setIngredientField: create.reducer((state, action: PayloadAction<Partial<IngredientForm>>) => {
      Object.assign(state.form, action.payload);
      // A new way of counting resets the par level's unit to its usual one.
      if (action.payload.baseUnit) state.form.parUnit = defaultUnit({ baseUnit: action.payload.baseUnit as BaseUnit, dozens: state.form.dozens });
    }),
    setCustomUnits: create.reducer((state, action: PayloadAction<CustomUnitRow[]>) => {
      state.customUnits = action.payload;
    }),
    touchIngredientForm: create.reducer(state => {
      state.touched = true;
    }),
    loadIngredientForEditAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return await fetchIngredient(id);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          Object.assign(state, initialState, { editingId: action.meta.arg, status: 'loading' as FormStatus });
        },
        fulfilled: (state, action) => {
          const payload = ingredientDetailSerializer(action.payload);
          state.status = 'succeeded';
          if (!payload) return;
          state.form = formOf(payload);
          state.customUnits = customUnitRows(payload.customUnits, payload.baseUnit);
          state.locked = payload.batches.length > 0 || payload.onHand !== 0;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "This ingredient didn't load.");
        },
      },
    ),
    saveIngredientAsync: create.asyncThunk(
      async ({ id, input }: { id: string | null; input: IngredientInput }, { rejectWithValue }) => {
        try {
          return id ? await updateIngredient(id, input) : await createIngredient(input);
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
          const payload = ingredientDetailSerializer(action.payload);
          state.saving = false;
          state.saved = payload;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "The ingredient didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectIngredientForm: state => state,
  },
});

export const { startIngredientForm, setIngredientField, setCustomUnits, touchIngredientForm, loadIngredientForEditAsync, saveIngredientAsync } = ingredientFormSlice.actions;
export const { selectIngredientForm } = ingredientFormSlice.selectors;
