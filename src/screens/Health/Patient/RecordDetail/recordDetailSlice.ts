// MetroMatrix — One health record (by id), the page being viewed full screen, and deleting it.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { deleteRecord, getRecord } from '@networks/health/recordsNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { HealthRecord } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export interface RecordEntry {
  record: HealthRecord | null;
  status: FormStatus;
  error: ServerError;
}

export interface RecordDetailSliceState {
  byId: Record<string, RecordEntry>;
  viewing: string | null;
  deleting: boolean;
  deleteError: ServerError;
}

const EMPTY: RecordEntry = { record: null, status: 'idle', error: NO_ERROR };
const initialState: RecordDetailSliceState = { byId: {}, viewing: null, deleting: false, deleteError: NO_ERROR };

export const recordDetailSlice = createAppSlice({
  name: 'recordDetail',
  initialState,
  reducers: create => ({
    viewPage: create.reducer((state, action: PayloadAction<string | null>) => {
      state.viewing = action.payload;
    }),
    loadRecordAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return await getRecord(id);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const e = (state.byId[action.meta.arg] ??= { ...EMPTY });
          e.status = 'loading';
          e.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.byId[action.meta.arg] = { record: action.payload, status: 'succeeded', error: NO_ERROR };
        },
        rejected: (state, action) => {
          const e = (state.byId[action.meta.arg] ??= { ...EMPTY });
          e.status = 'failed';
          e.error = readRejection(action, "The record didn't open.");
        },
      },
    ),
    deleteRecordAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          await deleteRecord(id);
          return id;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.deleting = true;
          state.deleteError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.deleting = false;
          delete state.byId[action.payload];
        },
        rejected: (state, action) => {
          state.deleting = false;
          state.deleteError = readRejection(action, "It wasn't deleted. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectRecordEntry: (state, id: string): RecordEntry => state.byId[id] ?? EMPTY,
    selectRecordUi: state => state,
  },
});

export const { viewPage, loadRecordAsync, deleteRecordAsync } = recordDetailSlice.actions;
export const { selectRecordEntry, selectRecordUi } = recordDetailSlice.selectors;
