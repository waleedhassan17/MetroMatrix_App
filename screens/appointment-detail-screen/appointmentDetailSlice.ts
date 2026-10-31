// ═══════════════════════════════════════════════════════
// MetroMatrix — Appointment detail slice (keyed by appointment code)
// ═══════════════════════════════════════════════════════
// One appointment and the patient's actions on it: cancel (with a reason),
// reschedule once (a date strip and slots for the same location, in a
// sheet), attach records. Every action answers with the whole appointment,
// so the screen always shows the server's state and flags. Also read by
// Booking confirmed, Payment proof, Video and Rate visit.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { cancelAppointment, fetchAppointment, rescheduleAppointment } from '../../networks/health/appointments';
import { fetchDays, fetchSlots } from '../../networks/health/availability';

import { toRejectedValue, required } from '../../networks/network/network';
import { alternativesFrom, appointmentDetailSerializer } from '../../serializers/health/appointmentSerializer';
import type { AppointmentDetail, CancelReason, DayAvailability, HealthRecord, Slot } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { submitAppointmentProofAsync } from '../payment-proof-screen/paymentProofSlice';
import { confirmBookingAsync } from '../book-appointment-sheet/bookAppointmentSlice';
import { daysSerializer, slotDaySerializer } from '../../serializers/health/discoverySerializer';
import { attachRecords, listRecords } from '../shared/healthReads';

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
  /** "Share more records": the patient's records, and which are picked. */
  recordsSheet: { open: boolean; records: HealthRecord[]; selected: string[]; loading: boolean };
  /** The appointment a reschedule just made (a new code). */
  rescheduled: ReturnType<typeof appointmentDetailSerializer>;
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
  recordsSheet: { open: false, records: [], selected: [], loading: false },
  rescheduled: null,
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
    closeRecordsSheet: create.reducer(state => {
      state.recordsSheet.open = false;
    }),
    togglePickedRecord: create.reducer((state, action: PayloadAction<string>) => {
      const id = action.payload;
      const sel = state.recordsSheet.selected;
      state.recordsSheet.selected = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id];
    }),

    /** Opens "Share more records" with what is already shared ticked. */
    openRecordsSheetAsync: create.asyncThunk(
      async (_: { shared: string[] }, { rejectWithValue }) => {
        try {
          return (await listRecords({ memberId: null, type: null }, 1, 50)).items;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.recordsSheet = { open: true, records: state.recordsSheet.records, selected: action.meta.arg.shared, loading: true };
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.recordsSheet.records = action.payload;
          state.recordsSheet.loading = false;
        },
        rejected: (state, action) => {
          state.recordsSheet.loading = false;
          state.actionError = readRejection(action, "Your records didn't load.");
        },
      },
    ),

    loadAppointmentAsync: create.asyncThunk(
      async (code: string, { rejectWithValue }) => {
        try {
          return await fetchAppointment(code);
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
        fulfilled: (state, action) => {
          const payload = appointmentDetailSerializer(action.payload);
          if (!payload) return;
          return save(state, payload);
        },
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
          const payload = appointmentDetailSerializer(action.payload);
          state.busy = null;
          state.cancelSheet.open = false;
          if (!payload) return;
          save(state, payload);
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
          const days = await fetchDays(doctorId, locationId, null, 14);
          // The first day with room decides which slots to read.
          const open = required(daysSerializer(days));
          const first = open.find(d => d.slotCount > 0)?.date ?? open[0]?.date ?? null;
          const slots = first ? await fetchSlots(doctorId, locationId, first) : null;
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
          const days = daysSerializer(action.payload.days);
          const slots = action.payload.slots === null ? null : slotDaySerializer(action.payload.slots);
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
          return await fetchSlots(doctorId, locationId, date);
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
          const payload = slotDaySerializer(action.payload);
          state.reschedule.loading = false;
          if (!payload) return;
          state.reschedule.slots = payload.slots;
          state.reschedule.timezone = payload.timezone;
          state.reschedule.nextAvailable = payload.nextAvailable;
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
          const payload = appointmentDetailSerializer(action.payload);
          state.busy = null;
          state.reschedule = NO_RESCHEDULE;
          if (!payload) return;
          save(state, payload);
          state.rescheduled = payload;
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
          state.recordsSheet.open = false;
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
    // A booking opens Booking confirmed without a second request.
    builder.addCase(confirmBookingAsync.fulfilled, (state, action) => {
          const payload = appointmentDetailSerializer(action.payload);
          if (!payload) return;
          return save(state, payload);
        });
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
  closeRecordsSheet,
  togglePickedRecord,
  openRecordsSheetAsync,
  loadAppointmentAsync,
  cancelAppointmentAsync,
  openRescheduleAsync,
  rescheduleDayAsync,
  rescheduleAsync,
  attachRecordsAsync,
} = appointmentDetailSlice.actions;
export const { selectAppointmentEntry, selectAppointmentState } = appointmentDetailSlice.selectors;
