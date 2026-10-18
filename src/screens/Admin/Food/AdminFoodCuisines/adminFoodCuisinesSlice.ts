// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Food cuisines slice
// ═══════════════════════════════════════════════════════
// The list, and the sheet that adds or edits one (name, link, icon, order).
// A cuisine vendors use can only be turned off; an unused one can go.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { createCuisine, deleteCuisine, listAdminCuisines, updateCuisine } from '@networks/admin/adminFoodNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { cuisineSlug } from '@models/food/adminFoodModel';
import type { AdminCuisine, AdminCuisineInput } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export interface CuisineSheet extends Omit<AdminCuisineInput, 'sort'> {
  /** '' for a new one. */
  id: string;
  sort: string;
  /** The link follows the name until it is edited. */
  slugEdited: boolean;
}

export interface AdminFoodCuisinesSliceState {
  cuisines: AdminCuisine[];
  status: FormStatus;
  sheet: CuisineSheet | null;
  submitted: boolean;
  busy: boolean;
  error: ServerError;
}

const initialState: AdminFoodCuisinesSliceState = { cuisines: [], status: 'idle', sheet: null, submitted: false, busy: false, error: NO_ERROR };

type Change = { kind: 'save'; sheet: CuisineSheet } | { kind: 'active'; id: string; isActive: boolean } | { kind: 'delete'; id: string };

export const adminFoodCuisinesSlice = createAppSlice({
  name: 'adminFoodCuisines',
  initialState,
  reducers: create => ({
    openCuisineSheet: create.reducer((state, action: PayloadAction<AdminCuisine | 'new' | null>) => {
      const c = action.payload;
      state.sheet =
        c === null
          ? null
          : c === 'new'
            ? { id: '', name: '', slug: '', icon: 'pakistani', sort: String((state.cuisines.at(-1)?.sort ?? 0) + 10), slugEdited: false }
            : { id: c.id, name: c.name, slug: c.slug, icon: c.icon, sort: String(c.sort), slugEdited: true };
      state.submitted = false;
      state.error = NO_ERROR;
    }),
    setCuisineSheet: create.reducer((state, action: PayloadAction<Partial<CuisineSheet>>) => {
      if (!state.sheet) return;
      const next = { ...state.sheet, ...action.payload };
      if (action.payload.slug !== undefined) next.slugEdited = true;
      if (action.payload.name !== undefined && !next.slugEdited && !next.id) next.slug = cuisineSlug(action.payload.name);
      state.sheet = next;
    }),
    markCuisineSubmitted: create.reducer(state => {
      state.submitted = true;
    }),

    loadAdminCuisinesAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await listAdminCuisines();
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
          state.cuisines = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't load the cuisines.");
        },
      },
    ),

    changeCuisineAsync: create.asyncThunk(
      async (change: Change, { rejectWithValue }) => {
        try {
          if (change.kind === 'save') {
            const input = { name: change.sheet.name, slug: change.sheet.slug, icon: change.sheet.icon, sort: Number(change.sheet.sort) };
            if (change.sheet.id) await updateCuisine(change.sheet.id, input);
            else await createCuisine(input);
          } else if (change.kind === 'active') await updateCuisine(change.id, { isActive: change.isActive });
          else await deleteCuisine(change.id);
          return await listAdminCuisines();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = false;
          state.sheet = null;
          state.cuisines = action.payload;
        },
        rejected: (state, action) => {
          state.busy = false;
          state.error = readRejection(action, "That didn't go through.");
        },
      },
    ),
  }),
  selectors: {
    selectAdminFoodCuisines: state => state,
  },
});

export const { openCuisineSheet, setCuisineSheet, markCuisineSubmitted, loadAdminCuisinesAsync, changeCuisineAsync } = adminFoodCuisinesSlice.actions;
export const { selectAdminFoodCuisines } = adminFoodCuisinesSlice.selectors;
