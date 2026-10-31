// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor (home kitchen): pre-order slots
// ═══════════════════════════════════════════════════════
// When customers can order ahead for: Friday 1 PM, orders close 3 hours
// before, at most 15 orders. The week is saved as a whole.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { getPreorderSlotsAPI, savePreorderSlotsAPI } from '../../networks/food/vendor/availabilityNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import { slotRow, slotsInput, type SlotRow } from '../../models/food/menuModel';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { preorderSlotsSerializer } from '../../serializers/food/menuSerializer';

export interface VendorPreorderSlotsSliceState {
  rows: SlotRow[];
  saved: string;
  status: FormStatus;
  saving: boolean;
  submitted: boolean;
  error: ServerError;
}

const initialState: VendorPreorderSlotsSliceState = { rows: [], saved: '[]', status: 'idle', saving: false, submitted: false, error: NO_ERROR };

export const vendorPreorderSlotsSlice = createAppSlice({
  name: 'vendorPreorderSlots',
  initialState,
  reducers: create => ({
    addSlot: create.reducer((state, action: PayloadAction<number>) => {
      const same = state.rows.filter(r => r.weekday === action.payload);
      state.rows.push({ weekday: action.payload, slotStart: same.length ? '19:30' : '13:00', cutoffMinutesBefore: 180, maxOrders: '15' });
    }),
    setSlot: create.reducer((state, action: PayloadAction<{ index: number; patch: Partial<SlotRow> }>) => {
      const r = state.rows[action.payload.index];
      if (r) Object.assign(r, action.payload.patch);
    }),
    removeSlot: create.reducer((state, action: PayloadAction<number>) => {
      state.rows.splice(action.payload, 1);
    }),
    markSlotsSubmitted: create.reducer(state => {
      state.submitted = true;
    }),
    loadPreorderSlotsAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return (required(preorderSlotsSerializer(await getPreorderSlotsAPI()))).map(slotRow);
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
          state.rows = action.payload;
          state.saved = JSON.stringify(action.payload);
          state.submitted = false;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your slots didn't load.");
        },
      },
    ),
    savePreorderSlotsAsync: create.asyncThunk(
      async (rows: SlotRow[], { rejectWithValue }) => {
        try {
          return (required(preorderSlotsSerializer(await savePreorderSlotsAPI(slotsInput(rows))))).map(slotRow);
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
          state.rows = action.payload;
          state.saved = JSON.stringify(action.payload);
          state.submitted = false;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "Your slots didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorPreorderSlots: state => state,
  },
});

export const { addSlot, setSlot, removeSlot, markSlotsSubmitted, loadPreorderSlotsAsync, savePreorderSlotsAsync } = vendorPreorderSlotsSlice.actions;
export const { selectVendorPreorderSlots } = vendorPreorderSlotsSlice.selectors;
