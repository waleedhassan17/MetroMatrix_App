// MetroMatrix — Kitchen: donations. Meals given away (to a shelter, a
// mosque, a langar) count with Bachat Box pickups as meals rescued.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchDonations, logDonation } from '../../networks/kitchen/waste';
import { toRejectedValue } from '../../networks/network/network';
import type { Donations } from '../../models';
import type { ValidationErrors } from '../../models/authModel';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { donationsSerializer } from '../../serializers/kitchen/wasteSerializer';

export interface DonationForm {
  meals: string;
  to: string;
  note: string;
}

export interface DonationsSliceState {
  data: Donations | null;
  status: FormStatus;
  error: ServerError;
  form: DonationForm;
  errors: ValidationErrors;
  saving: boolean;
  saveError: ServerError;
}

const EMPTY_FORM: DonationForm = { meals: '', to: '', note: '' };
const initialState: DonationsSliceState = { data: null, status: 'idle', error: NO_ERROR, form: EMPTY_FORM, errors: {}, saving: false, saveError: NO_ERROR };

export const donationsSlice = createAppSlice({
  name: 'donations',
  initialState,
  reducers: create => ({
    editDonation: create.reducer((state, action: PayloadAction<Partial<DonationForm>>) => {
      state.form = { ...state.form, ...action.payload };
      for (const k of Object.keys(action.payload)) delete state.errors[k];
    }),
    setDonationErrors: create.reducer((state, action: PayloadAction<ValidationErrors>) => {
      state.errors = action.payload;
    }),
    loadDonationsAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await fetchDonations();
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
          const payload = donationsSerializer(action.payload);
          state.status = 'succeeded';
          state.data = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Donations didn't load.");
        },
      },
    ),
    logDonationAsync: create.asyncThunk(
      async (input: { meals: number; to: string; note?: string }, { dispatch, rejectWithValue }) => {
        try {
          const logged = await logDonation(input);
          void dispatch(loadDonationsAsync());
          return logged;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
          state.saveError = NO_ERROR;
        },
        fulfilled: state => {
          state.saving = false;
          state.form = EMPTY_FORM;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.saveError = readRejection(action, "The donation didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectDonations: state => state,
  },
});

export const { editDonation, setDonationErrors, loadDonationsAsync, logDonationAsync } = donationsSlice.actions;
export const { selectDonations } = donationsSlice.selectors;
