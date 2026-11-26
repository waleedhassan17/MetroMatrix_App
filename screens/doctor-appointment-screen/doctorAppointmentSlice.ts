// ═══════════════════════════════════════════════════════
// MetroMatrix — One appointment, the doctor's side (keyed by id)
// ═══════════════════════════════════════════════════════
// Who the patient is with you (visits, missed, late cancels), what they
// shared, your earlier visits, private notes (and their files), the payment
// to check, a refund to record, and the moves the server allows now. Every
// action answers with the appointment. Saving notes keeps their files.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { openSharedRecord, type DoctorAction } from '../../networks/health/doctor/doctorAppointments';
import { errorCopy, toRejectedValue } from '../../networks/network/network';
import { uploadImage } from '../../services/mediaUpload';
import type { DoctorAppointmentDetail, LocalFile } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { healthRecordSerializer } from '../../serializers/health/recordsSerializer';
import {
  actOnAppointment,
  cancelByDoctor,
  completeAppointment,
  confirmPayment,
  getDoctorAppointment,
  refundAppointment,
  rejectPayment,
  saveNotes,
} from '../shared/practiceReads';

export interface DoctorAppointmentEntry {
  appointment: DoctorAppointmentDetail | null;
  status: FormStatus;
  error: ServerError;
}

export type DoctorMove = DoctorAction | 'complete' | 'cancel' | 'confirm-payment' | 'reject-payment' | 'refund' | 'notes';

export interface DoctorAppointmentSliceState {
  byId: Record<string, DoctorAppointmentEntry>;
  notes: Record<string, string>;
  /** The notes' files as they'll be saved (existing ones kept, new ones added). */
  noteFiles: Record<string, string[]>;
  /** A note file uploading. */
  attaching: boolean;
  busy: DoctorMove | null;
  /** `reason` is the refund reference on the refund sheet. */
  sheet: { kind: 'cancel' | 'reject' | 'complete' | 'refund' | null; reason: string };
  viewing: string | null;
  /** A shared report being opened (its files come with short-lived links, on demand). */
  openingRecord: string | null;
  error: ServerError;
}

const EMPTY: DoctorAppointmentEntry = { appointment: null, status: 'idle', error: NO_ERROR };
const initialState: DoctorAppointmentSliceState = {
  byId: {},
  notes: {},
  noteFiles: {},
  attaching: false,
  busy: null,
  sheet: { kind: null, reason: '' },
  viewing: null,
  openingRecord: null,
  error: NO_ERROR,
};

const save = (state: DoctorAppointmentSliceState, a: DoctorAppointmentDetail) => {
  state.byId[a.id] = { appointment: a, status: 'succeeded', error: NO_ERROR };
};

export const doctorAppointmentSlice = createAppSlice({
  name: 'doctorAppointment',
  initialState,
  reducers: create => ({
    setNotesDraft: create.reducer((state, action: PayloadAction<{ id: string; text: string }>) => {
      state.notes[action.payload.id] = action.payload.text;
    }),
    removeNoteFile: create.reducer((state, action: PayloadAction<{ id: string; url: string }>) => {
      state.noteFiles[action.payload.id] = (state.noteFiles[action.payload.id] ?? []).filter(u => u !== action.payload.url);
    }),
    openDoctorSheet: create.reducer((state, action: PayloadAction<'cancel' | 'reject' | 'complete' | 'refund'>) => {
      state.sheet = { kind: action.payload, reason: '' };
      state.error = NO_ERROR;
    }),
    closeDoctorSheet: create.reducer(state => {
      state.sheet.kind = null;
    }),
    setSheetReason: create.reducer((state, action: PayloadAction<string>) => {
      state.sheet.reason = action.payload;
    }),
    viewFile: create.reducer((state, action: PayloadAction<string | null>) => {
      state.viewing = action.payload;
    }),

    loadDoctorAppointmentAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return await getDoctorAppointment(id);
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
          save(state, action.payload);
          if (state.notes[action.payload.id] === undefined) state.notes[action.payload.id] = action.payload.notes.text;
          if (state.noteFiles[action.payload.id] === undefined) state.noteFiles[action.payload.id] = action.payload.notes.attachments;
        },
        rejected: (state, action) => {
          const e = (state.byId[action.meta.arg] ??= { ...EMPTY });
          e.status = 'failed';
          e.error = readRejection(action, "The appointment didn't open.");
        },
      },
    ),

    openSharedRecordAsync: create.asyncThunk(
      async ({ id, recordId }: { id: string; recordId: string }, { rejectWithValue }) => {
        try {
          return await openSharedRecord(id, recordId);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.openingRecord = action.meta.arg.recordId;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = healthRecordSerializer(action.payload);
          state.openingRecord = null;
          const record = state.byId[action.meta.arg.id]?.appointment?.records.find(r => r.id === action.meta.arg.recordId);
          if (!payload) return;
          if (record) record.files = payload.files;
        },
        rejected: (state, action) => {
          state.openingRecord = null;
          state.error = readRejection(action, "The report didn't open. It may no longer be shared.");
        },
      },
    ),

    /** A file for the notes (a photo or a PDF), uploaded now and saved with the notes. */
    attachNoteFileAsync: create.asyncThunk(
      async ({ file }: { id: string; file: LocalFile }, { rejectWithValue }) => {
        try {
          return (await uploadImage(file, 'consult_attachment')).url;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.attaching = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.attaching = false;
          const id = action.meta.arg.id;
          state.noteFiles[id] = [...(state.noteFiles[id] ?? []), action.payload];
        },
        rejected: (state, action) => {
          state.attaching = false;
          const error = readRejection(action, "The file didn't upload. Try again.");
          state.error = { ...error, message: errorCopy(error.code, error.details) ?? error.message };
        },
      },
    ),

    doctorMoveAsync: create.asyncThunk(
      async (
        {
          id,
          move,
          reason,
          paymentCollected,
          notes,
          files,
        }: { id: string; move: DoctorMove; reason?: string; paymentCollected?: boolean; notes?: string; files?: string[] },
        { rejectWithValue },
      ) => {
        try {
          switch (move) {
            case 'complete':
              return await completeAppointment(id, !!paymentCollected);
            case 'cancel':
              return await cancelByDoctor(id, reason ?? '');
            case 'confirm-payment':
              return await confirmPayment(id);
            case 'reject-payment':
              return await rejectPayment(id, reason ?? '');
            case 'refund':
              return await refundAppointment(id, (reason ?? '').trim());
            case 'notes':
              // The files go with the text: saving never drops the ones already there.
              return await saveNotes(id, { text: notes ?? '', attachments: files ?? [] });
            default:
              return await actOnAppointment(id, move);
          }
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busy = action.meta.arg.move;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = null;
          state.sheet.kind = null;
          save(state, action.payload);
          if (action.meta.arg.move === 'notes') state.noteFiles[action.payload.id] = action.payload.notes.attachments;
        },
        rejected: (state, action) => {
          state.busy = null;
          const error = readRejection(action, "That didn't go through. Pull down to refresh.");
          state.error = { ...error, message: errorCopy(error.code, error.details) ?? error.message };
        },
      },
    ),
  }),
  selectors: {
    selectDoctorAppointmentEntry: (state, id: string): DoctorAppointmentEntry => state.byId[id] ?? EMPTY,
    selectDoctorAppointmentUi: state => state,
  },
});

export const {
  setNotesDraft,
  removeNoteFile,
  attachNoteFileAsync,
  openDoctorSheet,
  closeDoctorSheet,
  setSheetReason,
  viewFile,
  loadDoctorAppointmentAsync,
  openSharedRecordAsync,
  doctorMoveAsync,
} = doctorAppointmentSlice.actions;
export const { selectDoctorAppointmentEntry, selectDoctorAppointmentUi } = doctorAppointmentSlice.selectors;
