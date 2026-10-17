// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor (home kitchen): the weekly menu
// ═══════════════════════════════════════════════════════
// Which days each dish is cooked: qorma every day, pulao on Fridays.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { listMenuItems } from '@networks/food/vendor/menuNetwork';
import { saveWeeklyMenu } from '@networks/food/vendor/availabilityNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { WeeklyMenuEntry } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { menuChanged } from '../VendorMenu/vendorMenuSlice';

export interface VendorWeeklyMenuSliceState {
  saved: WeeklyMenuEntry[];
  days: Record<string, number[]>;
  status: FormStatus;
  saving: boolean;
  error: ServerError;
}

const initialState: VendorWeeklyMenuSliceState = { saved: [], days: {}, status: 'idle', saving: false, error: NO_ERROR };

const daysById = (rows: WeeklyMenuEntry[]) => Object.fromEntries(rows.map(r => [r.itemId, r.days]));

export const vendorWeeklyMenuSlice = createAppSlice({
  name: 'vendorWeeklyMenu',
  initialState,
  reducers: create => ({
    toggleWeeklyDay: create.reducer((state, action: PayloadAction<{ itemId: string; day: number }>) => {
      const { itemId, day } = action.payload;
      const now = state.days[itemId] ?? [];
      state.days[itemId] = now.includes(day) ? now.filter(d => d !== day) : [...now, day].sort((a, b) => a - b);
    }),
    setWeeklyDays: create.reducer((state, action: PayloadAction<{ itemId: string; days: number[] }>) => {
      state.days[action.payload.itemId] = action.payload.days;
    }),
    loadWeeklyMenuAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return (await listMenuItems()).map(i => ({ itemId: i.id, name: i.name, days: i.days }));
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
          state.saved = action.payload;
          state.days = daysById(action.payload);
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The weekly menu didn't load.");
        },
      },
    ),
    saveWeeklyMenuAsync: create.asyncThunk(
      async (_: void, { getState, dispatch, rejectWithValue }) => {
        const { saved, days } = (getState() as { vendorWeeklyMenu: VendorWeeklyMenuSliceState }).vendorWeeklyMenu;
        const changed = saved.filter(r => JSON.stringify(r.days) !== JSON.stringify(days[r.itemId])).map(r => ({ itemId: r.itemId, days: days[r.itemId] }));
        try {
          const out = changed.length ? await saveWeeklyMenu(changed) : saved;
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
          state.saved = action.payload;
          state.days = daysById(action.payload);
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "The weekly menu didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorWeeklyMenu: state => state,
  },
});

export const { toggleWeeklyDay, setWeeklyDays, loadWeeklyMenuAsync, saveWeeklyMenuAsync } = vendorWeeklyMenuSlice.actions;
export const { selectVendorWeeklyMenu } = vendorWeeklyMenuSlice.selectors;
