// ═══════════════════════════════════════════════════════
// MetroMatrix — Appointment detail slice (keyed by appointment code)
// ═══════════════════════════════════════════════════════
// One appointment and the patient's actions on it: cancel (with a reason),
// reschedule once (a date strip and slots for the same location, in a
// sheet), attach records. Every action answers with the whole appointment,
// so the screen always shows the server's state and flags. Also read by
// Booking confirmed, Payment proof, Video and Rate visit.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { attachRecords, cancelAppointment, getAppointment, rescheduleAppointment } from '@networks/health/appointmentsNetwork';
import { listDays, listSlots } from '@networks/health/availabilityNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { alternativesFrom } from '@serializers/health/appointmentSerializer';
import type { AppointmentDetail, CancelReason, DayAvailability, Slot } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { submitAppointmentProofAsync } from '../../../Shopping/Customer/PaymentProof/paymentProofSlice';

export interface AppointmentEntry {
  appointment: AppointmentDetail | null;
  status: FormStatus;
  error: ServerError;
}

export interface RescheduleSheet {
  open: boolean;
  days: DayAvailability[];
  date: string | null;
  slots: Slot[];
  timezone: string;
  nextAvailable: { date: string; startAt: string } | null;
  selected: string | null;
  loading: boolean;
  /** A taken time's alternatives, shown in place. */
  alternatives: string[];
}

export interface AppointmentDetailSliceState {
  byCode: Record<string, AppointmentEntry>;
  busy: 'cancel' | 'reschedule' | 'records' | null;
  actionError: ServerError;
  cancelSheet: { open: boolean; reason: CancelReason | null; note: string };
  reschedule: RescheduleSheet;
}

const EMPTY: AppointmentEntry = { appointment: null, status: 'idle', error: NO_ERROR };
const NO_RESCHEDULE: RescheduleSheet = {
  open: false,
  days: [],
  date: null,
  slots: [],
  timezone: 'Asia/Karachi',
  nextAvailable: null,
  selected: null,
  loading: false,
  alternatives: [],
};

const initialState: AppointmentDetailSliceState = {
  byCode: {},
  busy: null,
  actionError: NO_ERROR,
  cancelSheet: { open: false, reason: null, note: '' },
  reschedule: NO_RESCHEDULE,
};

const save = (state: AppointmentDetailSliceState, a: AppointmentDetail) => {
  state.byCode[a.code] = { appointment: a, status: 'succeeded', error: NO_ERROR };
};

export const appointmentDetailSlice = createAppSlice({
  name: 'appointmentDetail',
  initialState,
  reducers: create => ({
    /** A booking or a review answered with the appointment: keep it. */
    appointmentReceived: create.reducer((state, action: PayloadAction<AppointmentDetail>) => {
      save(state, action.payload);
    }),
    openCancelSheet: create.reducer(state => {
      state.cancelSheet = { open: true, reason: null, note: '' };
      state.actionError = NO_ERROR;
    }),
    closeCancelSheet: create.reducer(state => {
      state.cancelSheet.open = false;
    }),
    setCancelReason: create.reducer((state, action: PayloadAction<CancelReason>) => {
      state.cancelSheet.reason = action.payload;
    }),
    setCancelNote: create.reducer((state, action: PayloadAction<string>) => {
      state.cancelSheet.note = action.payload;
    }),
    closeReschedule: create.reducer(state => {
      state.reschedule.open = false;
    }),
    pickRescheduleSlot: create.reducer((state, action: PayloadAction<string>) => {
      state.reschedule.selected = action.payload;
    }),

    loadAppointmentAsync: create.asyncThunk(
      async (code: string, { rejectWithValue }) => {
        try {
          return await getAppointment(code);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const e = (state.byCode[action.meta.arg] ??= { ...EMPTY });
          e.status = 'loading';
          e.error = NO_ERROR;
        },
        fulfilled: (state, action) => save(state, action.payload),
        rejected: (state, action) => {
          const e = (state.byCode[action.meta.arg] ??= { ...EMPTY });
          e.status = 'failed';
          e.error = readRejection(action, "We couldn't open this appointment.");
        },
      },
    ),

    cancelAppointmentAsync: create.asyncThunk(
      async ({ code, reason, note }: { code: string; reason: CancelReason; note: string }, { rejectWithValue }) => {
        try {
          return await cancelAppointment(code, reason, note.trim() || null);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = 'cancel';
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = null;
          state.cancelSheet.open = false;
          save(state, action.payload);
        },
        rejected: (state, action) => {
          state.busy = null;
          state.actionError = readRejection(action, "That didn't go through. Pull down to refresh and try again.");
        },
      },
    ),

    /** Opens the sheet on the appointment's location: its next two weeks. */
    openRescheduleAsync: create.asyncThunk(
      async ({ doctorId, locationId }: { doctorId: string; locationId: string }, { rejectWithValue }) => {
        try {
          const days = await listDays(doctorId, locationId, null, 14);
          const first = days.find(d => d.slotCount > 0)?.date ?? days[0]?.date ?? null;
          const slots = first ? await listSlots(doctorId, locationId, first) : null;
          return { days, slots };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.reschedule = { ...NO_RESCHEDULE, open: true, loading: true };
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const { days, slots } = action.payload;
          state.reschedule = {
            ...state.reschedule,
            loading: false,
            days,
            date: slots?.date ?? null,
            slots: slots?.slots ?? [],
            timezone: slots?.timezone ?? state.reschedule.timezone,
            nextAvailable: slots?.nextAvailable ?? null,
          };
        },
        rejected: (state, action) => {
          state.reschedule.loading = false;
          state.actionError = readRejection(action, "We couldn't load the doctor's times.");
        },
      },
    ),

    rescheduleDayAsync: create.asyncThunk(
      async ({ doctorId, locationId, date }: { doctorId: string; locationId: string; date: string }, { rejectWithValue }) => {
        try {
          return await listSlots(doctorId, locationId, date);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.reschedule.date = action.meta.arg.date;
          state.reschedule.loading = true;
          state.reschedule.selected = null;
          state.reschedule.alternatives = [];
        },
        fulfilled: (state, action) => {
          state.reschedule.loading = false;
          state.reschedule.slots = action.payload.slots;
          state.reschedule.timezone = action.payload.timezone;
          state.reschedule.nextAvailable = action.payload.nextAvailable;
        },
        rejected: (state, action) => {
          state.reschedule.loading = false;
          state.actionError = readRejection(action, "We couldn't load that day.");
        },
      },
    ),

    rescheduleAsync: create.asyncThunk(
      async ({ code, startAt }: { code: string; startAt: string }, { rejectWithValue }) => {
        try {
          return await rescheduleAppointment(code, startAt);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = 'reschedule';
          state.actionError = NO_ERROR;
          state.reschedule.alternatives = [];
        },
        fulfilled: (state, action) => {
          state.busy = null;
          state.reschedule = NO_RESCHEDULE;
          save(state, action.payload);
        },
        rejected: (state, action) => {
          state.busy = null;
          const error = readRejection(action, "That didn't go through. Try another time.");
          state.actionError = error;
          // Taken meanwhile: offer the next free times right here.
          if (error.code === 'SLOT_TAKEN') {
            state.reschedule.alternatives = alternativesFrom(error.details);
            state.reschedule.selected = null;
          }
        },
      },
    ),

    attachRecordsAsync: create.asyncThunk(
      async ({ code, recordIds }: { code: string; recordIds: string[] }, { rejectWithValue }) => {
        try {
          return await attachRecords(code, recordIds);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = 'records';
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = null;
          save(state, action.payload);
        },
        rejected: (state, action) => {
          state.busy = null;
          state.actionError = readRejection(action, "The records weren't shared. Try again.");
        },
      },
    ),
  }),
  extraReducers: builder => {
    // A sent payment proof answers with the whole appointment.
    builder.addCase(submitAppointmentProofAsync.fulfilled, (state, action) => save(state, action.payload));
  },
  selectors: {
    selectAppointmentEntry: (state, code: string): AppointmentEntry => state.byCode[code] ?? EMPTY,
    /** busy, actionError and the sheets (the slice itself, so the reference is stable). */
    selectAppointmentState: state => state,
  },
});

export const {
  appointmentReceived,
  openCancelSheet,
  closeCancelSheet,
  setCancelReason,
  setCancelNote,
  closeReschedule,
  pickRescheduleSlot,
  loadAppointmentAsync,
  cancelAppointmentAsync,
  openRescheduleAsync,
  rescheduleDayAsync,
  rescheduleAsync,
  attachRecordsAsync,
} = appointmentDetailSlice.actions;
export const { selectAppointmentEntry, selectAppointmentState } = appointmentDetailSlice.selectors;
