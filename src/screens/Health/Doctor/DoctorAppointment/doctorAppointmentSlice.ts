// ═══════════════════════════════════════════════════════
// MetroMatrix — One appointment, the doctor's side (keyed by id)
// ═══════════════════════════════════════════════════════
// Who the patient is with you (visits, missed, late cancels), what they
// shared, your earlier visits, private notes, the payment to check, and the
// moves the server allows now. Every action answers with the appointment.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { openSharedRecordAPI, type DoctorAction } from '@networks/health/doctor/doctorAppointmentsNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { DoctorAppointmentDetail } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { healthRecordSerializer } from '@serializers/health/recordsSerializer';
import { actOnAppointment, cancelByDoctor, completeAppointment, confirmPayment, getDoctorAppointment, rejectPayment, saveNotes } from '@screens/Health/Doctor/shared/practiceReads';

export interface DoctorAppointmentEntry {
  appointment: DoctorAppointmentDetail | null;
  status: FormStatus;
  error: ServerError;
}

export type DoctorMove = DoctorAction | 'complete' | 'cancel' | 'confirm-payment' | 'reject-payment' | 'notes';

export interface DoctorAppointmentSliceState {
  byId: Record<string, DoctorAppointmentEntry>;
  notes: Record<string, string>;
  busy: DoctorMove | null;
  sheet: { kind: 'cancel' | 'reject' | 'complete' | null; reason: string };
  viewing: string | null;
  /** A shared report being opened (its files come with short-lived links, on demand). */
  openingRecord: string | null;
  error: ServerError;
}

const EMPTY: DoctorAppointmentEntry = { appointment: null, status: 'idle', error: NO_ERROR };
const initialState: DoctorAppointmentSliceState = {
  byId: {},
  notes: {},
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
    openDoctorSheet: create.reducer((state, action: PayloadAction<'cancel' | 'reject' | 'complete'>) => {
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
          return required(healthRecordSerializer(await openSharedRecordAPI(id, recordId)));
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
          state.openingRecord = null;
          const record = state.byId[action.meta.arg.id]?.appointment?.records.find(r => r.id === action.meta.arg.recordId);
          if (record) record.files = action.payload.files;
        },
        rejected: (state, action) => {
          state.openingRecord = null;
          state.error = readRejection(action, "The report didn't open. It may no longer be shared.");
        },
      },
    ),

    doctorMoveAsync: create.asyncThunk(
      async ({ id, move, reason, paymentCollected, notes }: { id: string; move: DoctorMove; reason?: string; paymentCollected?: boolean; notes?: string }, { rejectWithValue }) => {
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
            case 'notes':
              return await saveNotes(id, { text: notes ?? '', attachments: [] });
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
        },
        rejected: (state, action) => {
          state.busy = null;
          state.error = readRejection(action, "That didn't go through. Pull down to refresh.");
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
  openDoctorSheet,
  closeDoctorSheet,
  setSheetReason,
  viewFile,
  loadDoctorAppointmentAsync,
  openSharedRecordAsync,
  doctorMoveAsync,
} = doctorAppointmentSlice.actions;
export const { selectDoctorAppointmentEntry, selectDoctorAppointmentUi } = doctorAppointmentSlice.selectors;
