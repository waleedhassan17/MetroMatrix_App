// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: the dish sheet
// ═══════════════════════════════════════════════════════
// One dish's sizes and add-on groups, what the customer picked, the live
// price and the first thing still to choose (itemSelectionModel). Opens
// over the vendor's page.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { getItemSheet } from '@networks/food/discoveryNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { MAX_NOTE, MAX_QUANTITY, chooseVariant, initialSelection, toggleOption, type Selection } from '@models/food/itemSelectionModel';
import type { ItemSheet } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export interface ItemSheetSliceState {
  /** The dish whose sheet is open (null: closed). */
  itemId: string | null;
  sheet: ItemSheet | null;
  selection: Selection | null;
  status: FormStatus;
  error: ServerError;
  /** The customer tried to add with something missing: show it. */
  tried: boolean;
}

const initialState: ItemSheetSliceState = { itemId: null, sheet: null, selection: null, status: 'idle', error: NO_ERROR, tried: false };

export const itemSheetSlice = createAppSlice({
  name: 'itemSheet',
  initialState,
  reducers: create => ({
    closeItemSheet: create.reducer(() => initialState),
    pickVariant: create.reducer((state, action: PayloadAction<string>) => {
      if (state.sheet && state.selection) state.selection = chooseVariant(state.sheet, state.selection, action.payload);
    }),
    pickOption: create.reducer((state, action: PayloadAction<{ groupId: string; optionId: string }>) => {
      if (state.sheet && state.selection) state.selection = toggleOption(state.sheet, state.selection, action.payload.groupId, action.payload.optionId);
    }),
    setLineQuantity: create.reducer((state, action: PayloadAction<number>) => {
      if (state.selection) state.selection.quantity = Math.max(1, Math.min(MAX_QUANTITY, action.payload));
    }),
    setLineNote: create.reducer((state, action: PayloadAction<string>) => {
      if (state.selection) state.selection.note = action.payload.slice(0, MAX_NOTE);
    }),
    markTried: create.reducer(state => {
      state.tried = true;
    }),
    openItemSheetAsync: create.asyncThunk(
      async (itemId: string, { rejectWithValue }) => {
        try {
          return await getItemSheet(itemId);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          Object.assign(state, initialState, { itemId: action.meta.arg, status: 'loading' });
        },
        fulfilled: (state, action) => {
          if (state.itemId !== action.meta.arg) return;
          state.status = 'succeeded';
          state.sheet = action.payload;
          state.selection = initialSelection(action.payload);
        },
        rejected: (state, action) => {
          if (state.itemId !== action.meta.arg) return;
          state.status = 'failed';
          state.error = readRejection(action, "This dish didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectItemSheet: state => state,
  },
});

export const { closeItemSheet, pickVariant, pickOption, setLineQuantity, setLineNote, markTried, openItemSheetAsync } = itemSheetSlice.actions;
export const { selectItemSheet } = itemSheetSlice.selectors;
