// ═══════════════════════════════════════════════════════
// MetroMatrix — Book an appointment (the confirm sheet)
// ═══════════════════════════════════════════════════════
// Who it's for, why (optional), reports to share, how to pay — then one
// Confirm. The Idempotency-Key is made when the sheet opens and kept for
// retries, so a double tap or a dropped connection books once. A time taken
// meanwhile comes back with three alternatives, offered in place.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../../store/createAppSlice';
import { bookAppointmentAPI } from '../../../../networks/health/appointmentsNetwork';

import { toRejectedValue, required } from '../../../../networks/network/apiHelpers';
import { alternativesFrom, appointmentDetailSerializer } from '../../../../serializers/health/appointmentSerializer';
import { defaultPaymentFor } from '../../../../models/health/bookingModel';
import type { AppointmentPaymentMethod, BookingInput, HealthRecord, PracticeLocation, ReasonTag } from '../../../../types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { listRecords } from '../shared/healthReads';

export interface BookingSheetState {
  open: boolean;
  /** The profile view that opened it (its grid drops a taken time). */
  viewKey: string | null;
  doctorId: string | null;
  doctorName: string;
  location: PracticeLocation | null;
  startAt: string | null;
  familyMemberId: string | null;
  reasonTags: ReasonTag[];
  reason: string;
  recordIds: string[];
  paymentMethod: AppointmentPaymentMethod;
  idempotencyKey: string;
  records: HealthRecord[];
  recordsOpen: boolean;
  status: FormStatus;
  error: ServerError;
  /** SLOT_TAKEN: the next free times at the same location. */
  alternatives: string[];
  /** The confirmed appointment's code (the screen navigates once it is set). */
  bookedCode: string | null;
}

const initialState: BookingSheetState = {
  open: false,
  viewKey: null,
  doctorId: null,
  doctorName: '',
  location: null,
  startAt: null,
  familyMemberId: null,
  reasonTags: [],
  reason: '',
  recordIds: [],
  paymentMethod: 'pay_at_visit',
  idempotencyKey: '',
  records: [],
  recordsOpen: false,
  status: 'idle',
  error: NO_ERROR,
  alternatives: [],
  bookedCode: null,
};

export const bookAppointmentSlice = createAppSlice({
  name: 'bookAppointment',
  initialState,
  reducers: create => ({
    openBooking: create.reducer(
      (
        state,
        action: PayloadAction<{ viewKey: string; doctorId: string; doctorName: string; location: PracticeLocation; startAt: string; idempotencyKey: string }>,
      ) => {
        const p = action.payload;
        const sameDoctor = state.doctorId === p.doctorId;
        return {
          ...initialState,
          // Who it's for and why survive reopening for the same doctor.
          familyMemberId: sameDoctor ? state.familyMemberId : null,
          reasonTags: sameDoctor ? state.reasonTags : [],
          reason: sameDoctor ? state.reason : '',
          recordIds: sameDoctor ? state.recordIds : [],
          records: state.records,
          open: true,
          viewKey: p.viewKey,
          doctorId: p.doctorId,
          doctorName: p.doctorName,
          location: p.location,
          startAt: p.startAt,
          paymentMethod: defaultPaymentFor(p.location),
          idempotencyKey: p.idempotencyKey,
        };
      },
    ),
    closeBooking: create.reducer(state => {
      state.open = false;
    }),
    bookingHandled: create.reducer(state => {
      state.bookedCode = null;
    }),
    setBookingFor: create.reducer((state, action: PayloadAction<string | null>) => {
      state.familyMemberId = action.payload;
    }),
    toggleReasonTag: create.reducer((state, action: PayloadAction<ReasonTag>) => {
      const t = action.payload;
      state.reasonTags = state.reasonTags.includes(t) ? state.reasonTags.filter(x => x !== t) : [...state.reasonTags, t];
    }),
    setBookingReason: create.reducer((state, action: PayloadAction<string>) => {
      state.reason = action.payload;
    }),
    setPaymentMethod: create.reducer((state, action: PayloadAction<AppointmentPaymentMethod>) => {
      state.paymentMethod = action.payload;
    }),
    toggleRecordsPicker: create.reducer(state => {
      state.recordsOpen = !state.recordsOpen;
    }),
    toggleRecord: create.reducer((state, action: PayloadAction<string>) => {
      const id = action.payload;
      state.recordIds = state.recordIds.includes(id) ? state.recordIds.filter(x => x !== id) : [...state.recordIds, id];
    }),
    /** Picking an alternative after SLOT_TAKEN. */
    pickAlternative: create.reducer((state, action: PayloadAction<string>) => {
      state.startAt = action.payload;
      state.alternatives = [];
      state.error = NO_ERROR;
    }),

    loadBookingRecordsAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return (await listRecords({ memberId: null, type: null }, 1, 30)).items;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        fulfilled: (state, action) => {
          state.records = action.payload;
        },
      },
    ),

    confirmBookingAsync: create.asyncThunk(
      async ({ input, idempotencyKey }: { input: BookingInput; idempotencyKey: string }, { rejectWithValue }) => {
        try {
          return required(appointmentDetailSerializer(await bookAppointmentAPI(input, idempotencyKey)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = NO_ERROR;
          state.alternatives = [];
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.open = false;
          state.bookedCode = action.payload.code;
          // A new booking is a new attempt.
          state.idempotencyKey = '';
          state.reasonTags = [];
          state.reason = '';
          state.recordIds = [];
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The appointment wasn't booked. Try again.");
          if (state.error.code === 'SLOT_TAKEN') state.alternatives = alternativesFrom(state.error.details);
        },
      },
    ),
  }),
  selectors: {
    selectBooking: state => state,
  },
});

export const {
  openBooking,
  closeBooking,
  bookingHandled,
  setBookingFor,
  toggleReasonTag,
  setBookingReason,
  setPaymentMethod,
  toggleRecordsPicker,
  toggleRecord,
  pickAlternative,
  loadBookingRecordsAsync,
  confirmBookingAsync,
} = bookAppointmentSlice.actions;
export const { selectBooking } = bookAppointmentSlice.selectors;
