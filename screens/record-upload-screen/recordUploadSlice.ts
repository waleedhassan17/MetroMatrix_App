// ═══════════════════════════════════════════════════════
// MetroMatrix — Upload a health record (one or many pages)
// ═══════════════════════════════════════════════════════
// Pages show at once and upload in the background (purpose health_record);
// Save sends only stored URLs and waits for any still uploading. Opened from
// an appointment, the new record is shared with it too.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';

import { uploadImage } from '../../services/mediaUpload';
import { toRejectedValue } from '../../networks/network/network';
import type { AppointmentDetail, HealthRecord, LocalFile, RecordInput, RecordType } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { createRecord, attachRecords } from '../shared/healthReads';

export interface RecordPage {
  key: string;
  uri: string;
  name: string;
  mime: string;
  url: string | null;
  progress: number | null;
}

export interface RecordUploadSliceState {
  title: string;
  type: RecordType;
  recordedOn: string;
  memberId: string | null;
  attachTo: string | null;
  pages: RecordPage[];
  touched: boolean;
  status: FormStatus;
  error: ServerError;
}

const initialState: RecordUploadSliceState = {
  title: '',
  type: 'lab_report',
  recordedOn: '',
  memberId: null,
  attachTo: null,
  pages: [],
  touched: false,
  status: 'idle',
  error: NO_ERROR,
};

export const pageKey = () => `pg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const recordUploadSlice = createAppSlice({
  name: 'recordUpload',
  initialState,
  reducers: create => ({
    startRecordUpload: create.reducer((_state, action: PayloadAction<{ memberId: string | null; attachTo: string | null; today: string }>) => ({
      ...initialState,
      memberId: action.payload.memberId,
      attachTo: action.payload.attachTo,
      recordedOn: action.payload.today,
    })),
    setRecordField: create.reducer((state, action: PayloadAction<Partial<Pick<RecordUploadSliceState, 'title' | 'type' | 'recordedOn' | 'memberId'>>>) => {
      Object.assign(state, action.payload);
    }),
    touchRecord: create.reducer(state => {
      state.touched = true;
    }),
    removePage: create.reducer((state, action: PayloadAction<string>) => {
      state.pages = state.pages.filter(p => p.key !== action.payload);
    }),
    pageProgress: create.reducer((state, action: PayloadAction<{ key: string; progress: number }>) => {
      const p = state.pages.find(x => x.key === action.payload.key);
      if (p && p.url === null) p.progress = action.payload.progress;
    }),

    addPageAsync: create.asyncThunk(
      async ({ key, file }: { key: string; file: LocalFile }, { dispatch, rejectWithValue }) => {
        try {
          return await uploadImage(file, 'health_record', progress => dispatch(recordUploadSlice.actions.pageProgress({ key, progress })));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const { key, file } = action.meta.arg;
          state.pages.push({ key, uri: file.uri, name: file.name, mime: file.mimeType, url: null, progress: 0 });
        },
        fulfilled: (state, action) => {
          const p = state.pages.find(x => x.key === action.meta.arg.key);
          if (p) {
            p.url = action.payload.url;
            p.progress = null;
          }
        },
        rejected: (state, action) => {
          state.pages = state.pages.filter(x => x.key !== action.meta.arg.key);
          state.error = readRejection(action, "A page didn't upload. Try adding it again.");
        },
      },
    ),

    saveRecordAsync: create.asyncThunk(
      async ({ input, attachTo }: { input: RecordInput; attachTo: string | null }, { rejectWithValue }) => {
        try {
          const record: HealthRecord = await createRecord(input);
          const appointment: AppointmentDetail | null = attachTo ? await attachRecords(attachTo, [record.id]) : null;
          return { record, appointment };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.touched = true;
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.status = 'succeeded';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The record wasn't saved. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectRecordUpload: state => state,
  },
});

export const { startRecordUpload, setRecordField, touchRecord, removePage, addPageAsync, saveRecordAsync } = recordUploadSlice.actions;
export const { selectRecordUpload } = recordUploadSlice.selectors;
