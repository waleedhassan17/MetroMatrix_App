// ═══════════════════════════════════════════════════════
// MetroMatrix — Doctor list slice (one query per open list)
// ═══════════════════════════════════════════════════════
// Lists stack (a specialty, then a similar doctor's specialty…), so each is
// keyed by its route. Quick chips change the query at once; the Sort &
// filter sheet edits a draft, shows how many doctors it would find, and
// applies on "Show".

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../../store/createAppSlice';
import { getDoctorsAPI } from '../../../../networks/health/discoveryNetwork';
import { toRejectedValue, required } from '../../../../networks/network/apiHelpers';
import { baseQuery, clearFilters, toggleQuick, type QuickFilter } from '../../../../models/health/filterModel';
import type { DoctorQuery } from '../../../../types';
import { doctorCardPageSerializer } from '../../../../serializers/health/discoverySerializer';

export interface DoctorListView {
  query: DoctorQuery;
  sheetOpen: boolean;
  draft: DoctorQuery;
  /** How many doctors the draft finds (null while counting). */
  draftTotal: number | null;
}

export interface DoctorListSliceState {
  views: Record<string, DoctorListView>;
}

const initialState: DoctorListSliceState = { views: {} };

export const doctorListSlice = createAppSlice({
  name: 'doctorList',
  initialState,
  reducers: create => ({
    openDoctorList: create.reducer((state, action: PayloadAction<{ key: string; query: DoctorQuery }>) => {
      if (state.views[action.payload.key]) return;
      state.views[action.payload.key] = { query: action.payload.query, sheetOpen: false, draft: action.payload.query, draftTotal: null };
    }),
    closeDoctorList: create.reducer((state, action: PayloadAction<string>) => {
      delete state.views[action.payload];
    }),
    toggleQuickFilter: create.reducer((state, action: PayloadAction<{ key: string; filter: QuickFilter }>) => {
      const v = state.views[action.payload.key];
      if (v) v.query = toggleQuick(v.query, action.payload.filter);
    }),
    clearDoctorFilters: create.reducer((state, action: PayloadAction<string>) => {
      const v = state.views[action.payload];
      if (v) v.query = clearFilters(v.query);
    }),
    openFilterSheet: create.reducer((state, action: PayloadAction<string>) => {
      const v = state.views[action.payload];
      if (!v) return;
      v.sheetOpen = true;
      v.draft = v.query;
      v.draftTotal = null;
    }),
    closeFilterSheet: create.reducer((state, action: PayloadAction<string>) => {
      const v = state.views[action.payload];
      if (v) v.sheetOpen = false;
    }),
    editDraft: create.reducer((state, action: PayloadAction<{ key: string; patch: Partial<DoctorQuery> }>) => {
      const v = state.views[action.payload.key];
      if (!v) return;
      v.draft = { ...v.draft, ...action.payload.patch };
      v.draftTotal = null;
    }),
    resetDraft: create.reducer((state, action: PayloadAction<string>) => {
      const v = state.views[action.payload];
      if (!v) return;
      v.draft = clearFilters(v.draft);
      v.draftTotal = null;
    }),
    applyDraft: create.reducer((state, action: PayloadAction<string>) => {
      const v = state.views[action.payload];
      if (!v) return;
      v.query = v.draft;
      v.sheetOpen = false;
    }),

    /** "Show N doctors": the draft's total, from a one-row page. */
    countDraftAsync: create.asyncThunk(
      async ({ query }: { key: string; query: DoctorQuery }, { rejectWithValue }) => {
        try {
          return (required(doctorCardPageSerializer(await getDoctorsAPI(query, 1, 1)))).total;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          const v = state.views[action.meta.arg.key];
          if (v && JSON.stringify(v.draft) === JSON.stringify(action.meta.arg.query)) v.draftTotal = action.payload;
        },
      },
    ),
  }),
  selectors: {
    selectDoctorListView: (state, key: string): DoctorListView | null => state.views[key] ?? null,
  },
});

export const {
  openDoctorList,
  closeDoctorList,
  toggleQuickFilter,
  clearDoctorFilters,
  openFilterSheet,
  closeFilterSheet,
  editDraft,
  resetDraft,
  applyDraft,
  countDraftAsync,
} = doctorListSlice.actions;
export const { selectDoctorListView } = doctorListSlice.selectors;

export { baseQuery };
