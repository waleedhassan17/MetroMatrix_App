// MetroMatrix — Kitchen: a stock count. What the cook counted per
// ingredient (as typed, in a unit they pick), saved together; the API
// records the difference as a movement.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchStock, recordStockTake } from '../../networks/kitchen/stock';
import { toRejectedValue, required } from '../../networks/network/network';
import type { Ingredient, StockTakeResult } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { stockListSerializer, stockTakeSerializer } from '../../serializers/kitchen/stockSerializer';

export interface StockTakeSliceState {
  ingredients: Ingredient[];
  /** ingredientId → what was typed, and the unit key it was typed in. */
  typed: Record<string, string>;
  units: Record<string, string>;
  rowErrors: Record<string, string>;
  status: FormStatus;
  error: ServerError;
  saving: boolean;
  result: StockTakeResult | null;
}

const initialState: StockTakeSliceState = { ingredients: [], typed: {}, units: {}, rowErrors: {}, status: 'idle', error: NO_ERROR, saving: false, result: null };

export const stockTakeSlice = createAppSlice({
  name: 'stockTake',
  initialState,
  reducers: create => ({
    resetStockTake: create.reducer(() => initialState),
    setCount: create.reducer((state, action: PayloadAction<{ id: string; text: string }>) => {
      state.typed[action.payload.id] = action.payload.text.slice(0, 12);
      delete state.rowErrors[action.payload.id];
    }),
    setCountUnit: create.reducer((state, action: PayloadAction<{ id: string; unit: string }>) => {
      state.units[action.payload.id] = action.payload.unit;
    }),
    setRowErrors: create.reducer((state, action: PayloadAction<Record<string, string>>) => {
      state.rowErrors = action.payload;
    }),
    loadStockTakeAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(stockListSerializer(await fetchStock('all', '')));
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
          state.ingredients = action.payload.items;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your stock didn't load.");
        },
      },
    ),
    saveStockTakeAsync: create.asyncThunk(
      async (lines: { ingredientId: string; counted: number }[], { rejectWithValue }) => {
        try {
          return required(stockTakeSerializer(await recordStockTake(lines)));
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
          state.saving = false;
          state.result = action.payload;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "The count didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectStockTake: state => state,
  },
});

export const { resetStockTake, setCount, setCountUnit, setRowErrors, loadStockTakeAsync, saveStockTakeAsync } = stockTakeSlice.actions;
export const { selectStockTake } = stockTakeSlice.selectors;
