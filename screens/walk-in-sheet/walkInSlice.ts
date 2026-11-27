// ═══════════════════════════════════════════════════════
// MetroMatrix — Add a walk-in (someone at the clinic desk without a booking)
// ═══════════════════════════════════════════════════════
// Name (phone, gender and age if they give them) and why they came, at one of
// your clinics: POST /health/doctor/appointments/walk-in puts them in the
// slot running now (or the next free one today), checked in at once, paying
// at the clinic. They have no account, so nothing is sent to them.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { addWalkIn } from '../../networks/health/doctor/doctorAppointments';
import { errorCopy, fieldErrors, toRejectedValue } from '../../networks/network/network';
import { createdAppointmentSerializer } from '../../serializers/health/doctorSerializer';
import { walkInToSave, type WalkInForm } from '../../models/health/bookingModel';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';

export interface WalkInSheetState {
  open: boolean;
  /** The clinics a walk-in can join (video takes none). */
  clinics: { id: string; name: string }[];
  form: WalkInForm;
  touched: boolean;
  status: FormStatus;
  error: ServerError;
  serverErrors: Record<string, string>;
  /** The new visit's code, once added. */
  added: string | null;
}

const blank = (locationId = ''): WalkInForm => ({ locationId, name: '', phone: '', gender: null, age: '', reason: '' });

const initialState: WalkInSheetState = {
  open: false,
  clinics: [],
  form: blank(),
  touched: false,
  status: 'idle',
  error: NO_ERROR,
  serverErrors: {},
  added: null,
};

/** The API's field names → the form's. */
const FIELD: Record<string, keyof WalkInForm> = {
  'patient.name': 'name',
  'patient.phone': 'phone',
  'patient.age': 'age',
  'patient.gender': 'gender',
  reason: 'reason',
  locationId: 'locationId',
};

export const walkInSlice = createAppSlice({
  name: 'walkIn',
  initialState,
  reducers: create => ({
    openWalkIn: create.reducer((state, action: PayloadAction<{ clinics: { id: string; name: string }[]; locationId: string | null }>) => ({
      ...initialState,
      open: true,
      clinics: action.payload.clinics,
      form: blank(action.payload.locationId ?? action.payload.clinics[0]?.id ?? ''),
    })),
    closeWalkIn: create.reducer(state => {
      state.open = false;
    }),
    editWalkIn: create.reducer((state, action: PayloadAction<Partial<WalkInForm>>) => {
      state.form = { ...state.form, ...action.payload };
      for (const k of Object.keys(action.payload)) delete state.serverErrors[k];
    }),
    touchWalkIn: create.reducer(state => {
      state.touched = true;
    }),
    clearWalkInAdded: create.reducer(state => {
      state.added = null;
    }),
    addWalkInAsync: create.asyncThunk(
      async (form: WalkInForm, { rejectWithValue }) => {
        try {
          return await addWalkIn(walkInToSave(form, null));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.touched = true;
          state.error = NO_ERROR;
          state.serverErrors = {};
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          const made = createdAppointmentSerializer(action.payload);
          if (!made) return;
          state.added = made.code;
          state.open = false;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          const error = readRejection(action, "They weren't added. Try again.");
          const fields = fieldErrors(error.details);
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(fields)) if (FIELD[k]) mapped[FIELD[k]] = v;
          state.serverErrors = mapped;
          state.error = Object.keys(mapped).length
            ? { ...error, message: 'Check the highlighted fields.' }
            : { ...error, message: errorCopy(error.code, error.details) ?? error.message };
        },
      },
    ),
  }),
  selectors: {
    selectWalkIn: state => state,
  },
});

export const { openWalkIn, closeWalkIn, editWalkIn, touchWalkIn, clearWalkInAdded, addWalkInAsync } = walkInSlice.actions;
export const { selectWalkIn } = walkInSlice.selectors;
