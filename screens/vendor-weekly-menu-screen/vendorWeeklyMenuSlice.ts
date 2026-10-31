// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor (home kitchen): the weekly menu
// ═══════════════════════════════════════════════════════
// Which days each dish is cooked: qorma every day, pulao on Fridays.

import { current, type PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchMenuItems } from '../../networks/food/vendor/menu';
import { saveWeeklyMenu } from '../../networks/food/vendor/availability';
import { toRejectedValue } from '../../networks/network/network';
import type { WeeklyMenuEntry } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { menuChanged } from '../vendor-menu-screen/vendorMenuSlice';
import { vendorMenuItemsSerializer, weeklyMenuSerializer } from '../../serializers/food/menuSerializer';

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
          return await fetchMenuItems();
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
          const saved = vendorMenuItemsSerializer(action.payload).map(i => ({ itemId: i.id, name: i.name, days: i.days }));
          state.status = 'succeeded';
          state.saved = saved;
          state.days = daysById(saved);
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
          // Nothing changed: nothing is sent, and the form goes back to what is saved.
          const out = changed.length ? await saveWeeklyMenu(changed) : null;
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
          const saved = action.payload === null ? null : weeklyMenuSerializer(action.payload);
          state.saving = false;
          if (saved) state.saved = saved;
          state.days = daysById(saved ?? current(state).saved);
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
