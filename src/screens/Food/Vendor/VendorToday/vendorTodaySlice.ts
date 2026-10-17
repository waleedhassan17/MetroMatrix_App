// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor (home kitchen): Today
// ═══════════════════════════════════════════════════════
// What is cooking today and how many plates: setting portions resets what is
// left; a dish switched off is off for today only. Changes collect locally
// and go up together.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { getToday, setToday } from '@networks/food/vendor/availabilityNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { TodayMenu } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { menuChanged } from '../VendorMenu/vendorMenuSlice';

export interface TodayEdit {
  portions?: number | null;
  cooking?: boolean;
}

export interface VendorTodaySliceState {
  today: TodayMenu | null;
  edits: Record<string, TodayEdit>;
  status: FormStatus;
  saving: boolean;
  error: ServerError;
}

const initialState: VendorTodaySliceState = { today: null, edits: {}, status: 'idle', saving: false, error: NO_ERROR };

export const vendorTodaySlice = createAppSlice({
  name: 'vendorToday',
  initialState,
  reducers: create => ({
    editToday: create.reducer((state, action: PayloadAction<{ itemId: string; edit: TodayEdit }>) => {
      const { itemId, edit } = action.payload;
      const row = state.today?.items.find(i => i.itemId === itemId);
      const next = { ...state.edits[itemId], ...edit };
      // Back to what the server has: nothing to send for it.
      if (row && (next.portions === undefined || next.portions === row.dailyLimit) && (next.cooking === undefined || next.cooking === row.cooking)) delete state.edits[itemId];
      else state.edits[itemId] = next;
    }),
    discardToday: create.reducer(state => {
      state.edits = {};
    }),
    loadTodayAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await getToday();
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
          state.today = action.payload;
          state.edits = {};
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Today's menu didn't load.");
        },
      },
    ),
    saveTodayAsync: create.asyncThunk(
      async (_: void, { getState, dispatch, rejectWithValue }) => {
        const { edits } = (getState() as { vendorToday: VendorTodaySliceState }).vendorToday;
        try {
          const out = await setToday(Object.entries(edits).map(([itemId, e]) => ({ itemId, ...e })));
          dispatch(menuChanged());
          return out;
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
          state.today = action.payload;
          state.edits = {};
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "Today's changes didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorToday: state => state,
  },
});

export const { editToday, discardToday, loadTodayAsync, saveTodayAsync } = vendorTodaySlice.actions;
export const { selectVendorToday } = vendorTodaySlice.selectors;
