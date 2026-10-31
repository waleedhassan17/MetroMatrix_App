// MetroMatrix — Kitchen growth: catering. Requests by where they stand, the
// month's events, and whether (and how) the kitchen takes requests.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchCateringCalendar, fetchCateringSettings, fetchCateringRequests, updateCateringSettings } from '../../networks/foodGrowth/catering';
import { toRejectedValue, required } from '../../networks/network/network';
import type { CateringCalendar, CateringInbox, CateringSettings } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { cateringInboxSerializer, cateringSettingsSerializer, cateringCalendarSerializer } from '../../serializers/kitchen/growthSerializer';

export type CateringTab = 'new' | 'quoted' | 'confirmed' | 'past' | 'calendar';

export interface CateringSliceState {
  tab: CateringTab;
  inbox: CateringInbox | null;
  settings: CateringSettings | null;
  month: string | null;
  calendar: CateringCalendar | null;
  status: FormStatus;
  error: ServerError;
  saving: boolean;
  saveError: ServerError;
}

const initialState: CateringSliceState = { tab: 'new', inbox: null, settings: null, month: null, calendar: null, status: 'idle', error: NO_ERROR, saving: false, saveError: NO_ERROR };

export const cateringSlice = createAppSlice({
  name: 'catering',
  initialState,
  reducers: create => ({
    setCateringTab: create.reducer((state, action: PayloadAction<CateringTab>) => {
      state.tab = action.payload;
    }),
    loadCateringAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          const [inbox, settings] = await Promise.all([fetchCateringRequests(), fetchCateringSettings()]);
          return { inbox, settings };
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
          const payload = { inbox: cateringInboxSerializer(action.payload.inbox), settings: cateringSettingsSerializer(action.payload.settings) };
          state.status = 'succeeded';
          state.inbox = payload.inbox;
          state.settings = payload.settings;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Catering didn't load.");
        },
      },
    ),
    loadCateringCalendarAsync: create.asyncThunk(
      async (month: string, { rejectWithValue }) => {
        try {
          return await fetchCateringCalendar(month);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.month = action.meta.arg;
        },
        fulfilled: (state, action) => {
          const payload = cateringCalendarSerializer(action.payload);
          state.calendar = payload;
        },
        rejected: (state, action) => {
          state.error = readRejection(action, "The calendar didn't load.");
        },
      },
    ),
    saveCateringSettingsAsync: create.asyncThunk(
      async (patch: Partial<CateringSettings>, { rejectWithValue }) => {
        try {
          return await updateCateringSettings(patch);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
          state.saveError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = cateringSettingsSerializer(action.payload);
          state.saving = false;
          state.settings = payload;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.saveError = readRejection(action, "That didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectCatering: state => state,
  },
});

export const { setCateringTab, loadCateringAsync, loadCateringCalendarAsync, saveCateringSettingsAsync } = cateringSlice.actions;
export const { selectCatering } = cateringSlice.selectors;
