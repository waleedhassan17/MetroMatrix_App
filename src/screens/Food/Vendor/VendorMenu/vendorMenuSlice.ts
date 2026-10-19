// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: the menu (the Menu tab)
// ═══════════════════════════════════════════════════════
// Categories with their dishes, and what can be ordered right now: a dish
// switched off, or off until a time. The dish editor, categories and the
// add-on library refresh it when they save (menuChanged).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { listMenuCategories, listMenuItems } from '@networks/food/vendor/menuNetwork';
import { getAvailability, setAvailability } from '@networks/food/vendor/availabilityNetwork';
import { getBoardHints } from '@networks/kitchen/costingNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { AvailabilityItem, BoardHints, MenuCategory, VendorMenuItem } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export interface VendorMenuSliceState {
  categories: MenuCategory[];
  items: VendorMenuItem[];
  /** Availability by dish id. */
  availability: Record<string, AvailabilityItem>;
  status: FormStatus;
  error: ServerError;
  /** The dish whose "switch off for…" sheet is open. */
  offItemId: string | null;
  /** Dishes whose switch is being saved. */
  saving: string[];
  /** Bumped by the editors so the tab reloads when it is next in view. */
  stale: boolean;
  /** Dishes low on stock or out of it by their recipes (TODO(API_KITCHEN); null when the kitchen side is unavailable). */
  stock: BoardHints | null;
}

const initialState: VendorMenuSliceState = {
  categories: [],
  items: [],
  availability: {},
  status: 'idle',
  error: NO_ERROR,
  offItemId: null,
  saving: [],
  stale: false,
  stock: null,
};

const byId = (rows: AvailabilityItem[]) => Object.fromEntries(rows.map(r => [r.itemId, r]));

export const vendorMenuSlice = createAppSlice({
  name: 'vendorMenu',
  initialState,
  reducers: create => ({
    openOffSheet: create.reducer((state, action: PayloadAction<string>) => {
      state.offItemId = action.payload;
    }),
    closeOffSheet: create.reducer(state => {
      state.offItemId = null;
    }),
    /** An editor saved: reload when the tab is next in view. */
    menuChanged: create.reducer(state => {
      state.stale = true;
    }),
    loadVendorMenuAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          const [categories, items, availability, stock] = await Promise.all([listMenuCategories(), listMenuItems(), getAvailability(), getBoardHints().catch(() => null)]);
          return { categories, items, availability, stock };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = NO_ERROR;
          state.stale = false;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.categories = action.payload.categories;
          state.items = action.payload.items;
          state.availability = byId(action.payload.availability.items);
          state.stock = action.payload.stock;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your menu didn't load.");
        },
      },
    ),
    /** On, off, or off until a time (then back on its own). */
    setDishAvailableAsync: create.asyncThunk(
      async (input: { itemId: string; isAvailable: boolean; until: string | null }, { rejectWithValue }) => {
        try {
          return await setAvailability({ items: [{ itemId: input.itemId, isAvailable: input.isAvailable, ...(input.isAvailable ? null : { unavailableUntil: input.until }) }] });
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const { itemId, isAvailable, until } = action.meta.arg;
          state.saving.push(itemId);
          state.offItemId = null;
          state.error = NO_ERROR;
          const row = state.availability[itemId];
          if (row) state.availability[itemId] = { ...row, isAvailable, unavailableUntil: isAvailable ? null : until };
        },
        fulfilled: (state, action) => {
          state.saving = state.saving.filter(id => id !== action.meta.arg.itemId);
          state.availability = byId(action.payload.items);
        },
        rejected: (state, action) => {
          const { itemId, isAvailable } = action.meta.arg;
          state.saving = state.saving.filter(id => id !== itemId);
          const row = state.availability[itemId];
          if (row) state.availability[itemId] = { ...row, isAvailable: !isAvailable, unavailableUntil: null };
          state.error = readRejection(action, "That didn't change. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorMenu: state => state,
  },
});

export const { openOffSheet, closeOffSheet, menuChanged, loadVendorMenuAsync, setDishAvailableAsync } = vendorMenuSlice.actions;
export const { selectVendorMenu } = vendorMenuSlice.selectors;
