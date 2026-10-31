// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor closures (days the kitchen is shut)
// ═══════════════════════════════════════════════════════
// A holiday or a family event: whole days, from the first to the last day
// closed, in Pakistan time. Customers see the kitchen closed then.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { addClosureAPI, getClosuresAPI, removeClosureAPI } from '../../networks/food/vendor/settingsNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import type { VendorClosure } from '../../models';
import { PKT, addDays, zonedToIso } from '../../utils/health-time/healthTime';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { closuresSerializer } from '../../serializers/food/vendorSerializer';

export interface ClosureForm {
  /** YYYY-MM-DD, the first and the last day closed. */
  from: string;
  to: string;
  reason: string;
}

export interface VendorClosuresSliceState {
  closures: VendorClosure[];
  status: FormStatus;
  busy: boolean;
  sheet: boolean;
  form: ClosureForm;
  submitted: boolean;
  error: ServerError;
}

const blank = (): ClosureForm => ({ from: '', to: '', reason: '' });

const initialState: VendorClosuresSliceState = { closures: [], status: 'idle', busy: false, sheet: false, form: blank(), submitted: false, error: NO_ERROR };

export const validateClosure = (f: ClosureForm): Record<string, string> => {
  const e: Record<string, string> = {};
  if (!f.from) e.from = 'Pick the first day';
  if (!f.to) e.to = 'Pick the last day';
  else if (f.from && f.to < f.from) e.to = 'The last day is before the first';
  if (f.reason.trim().length > 200) e.reason = 'Keep it under 200 characters';
  return e;
};

export const vendorClosuresSlice = createAppSlice({
  name: 'vendorClosures',
  initialState,
  reducers: create => ({
    openClosureSheet: create.reducer(state => {
      state.sheet = true;
      state.form = blank();
      state.submitted = false;
      state.error = NO_ERROR;
    }),
    closeClosureSheet: create.reducer(state => {
      state.sheet = false;
    }),
    setClosureField: create.reducer((state, action: PayloadAction<{ field: keyof ClosureForm; value: string }>) => {
      state.form[action.payload.field] = action.payload.value;
      if (action.payload.field === 'from' && (!state.form.to || state.form.to < action.payload.value)) state.form.to = action.payload.value;
    }),
    markClosureSubmitted: create.reducer(state => {
      state.submitted = true;
    }),
    loadClosuresAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(closuresSerializer(await getClosuresAPI()));
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
          state.status = 'succeeded';
          state.closures = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your closures didn't load.");
        },
      },
    ),
    addClosureAsync: create.asyncThunk(
      async (form: ClosureForm, { rejectWithValue }) => {
        try {
          // Whole days in Pakistan time: from the first day's midnight to the day after the last.
          await addClosureAPI({
            startsAt: zonedToIso(form.from, '00:00', PKT),
            endsAt: zonedToIso(addDays(form.to, 1), '00:00', PKT),
            reason: form.reason.trim() || null,
          });
          return required(closuresSerializer(await getClosuresAPI()));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = false;
          state.closures = action.payload;
          state.sheet = false;
        },
        rejected: (state, action) => {
          state.busy = false;
          state.error = readRejection(action, "That closure didn't save.");
        },
      },
    ),
    removeClosureAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          await removeClosureAPI(id);
          return id;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.busy = true;
        },
        fulfilled: (state, action) => {
          state.busy = false;
          state.closures = state.closures.filter(c => c.id !== action.payload);
        },
        rejected: (state, action) => {
          state.busy = false;
          state.error = readRejection(action, "That closure wasn't removed.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorClosures: state => state,
  },
});

export const {
  openClosureSheet,
  closeClosureSheet,
  setClosureField,
  markClosureSubmitted,
  loadClosuresAsync,
  addClosureAsync,
  removeClosureAsync,
} = vendorClosuresSlice.actions;
export const { selectVendorClosures } = vendorClosuresSlice.selectors;
