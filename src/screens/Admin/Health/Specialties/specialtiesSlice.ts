// MetroMatrix — Admin specialties slice: the list in patients' order, the
// add/edit sheet, delete and move up/down.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { getAdminSpecialtiesAPI } from '@networks/admin/adminHealthNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import { specialtyInput, type SpecialtyForm } from '@models/health/adminHealthModel';
import type { AdminSpecialty } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { adminSpecialtyListSerializer } from '@serializers/health/adminHealthSerializer';
import { createSpecialty, deleteSpecialty, updateSpecialty } from '@screens/Admin/Health/shared/taxonomyWrites';

export interface SpecialtiesSliceState {
  list: AdminSpecialty[];
  status: FormStatus;
  busy: boolean;
  error: ServerError;
  sheet: SpecialtyForm | null;
  touched: boolean;
}

const initialState: SpecialtiesSliceState = { list: [], status: 'idle', busy: false, error: NO_ERROR, sheet: null, touched: false };

type Change =
  | { kind: 'save'; form: SpecialtyForm }
  | { kind: 'delete'; id: string }
  /** The whole list in its new order; places are renumbered 1, 2, 3… */
  | { kind: 'reorder'; list: AdminSpecialty[] };

export const specialtiesSlice = createAppSlice({
  name: 'adminSpecialties',
  initialState,
  reducers: create => ({
    openSpecialtySheet: create.reducer((state, action: PayloadAction<SpecialtyForm | null>) => {
      state.sheet = action.payload;
      state.touched = false;
      state.error = NO_ERROR;
    }),
    setSpecialtyForm: create.reducer((state, action: PayloadAction<Partial<SpecialtyForm>>) => {
      if (state.sheet) state.sheet = { ...state.sheet, ...action.payload };
    }),
    touchSpecialtyForm: create.reducer(state => {
      state.touched = true;
    }),
    loadSpecialtiesAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(adminSpecialtyListSerializer(await getAdminSpecialtiesAPI()));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.list = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't load the specialties.");
        },
      },
    ),
    changeSpecialtyAsync: create.asyncThunk(
      async (change: Change, { rejectWithValue }) => {
        try {
          if (change.kind === 'save') {
            const input = specialtyInput(change.form);
            await (change.form.id ? updateSpecialty(change.form.id, input) : createSpecialty(input));
          } else if (change.kind === 'delete') await deleteSpecialty(change.id);
          else {
            // Only the rows whose place changed are sent.
            for (const [i, x] of change.list.entries()) if (x.sort !== i + 1) await updateSpecialty(x.id, { sort: i + 1 });
          }
          return required(adminSpecialtyListSerializer(await getAdminSpecialtiesAPI()));
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
          state.list = action.payload;
          state.sheet = null;
        },
        rejected: (state, action) => {
          state.busy = false;
          state.error = readRejection(action, "That didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectAdminSpecialties: state => state,
  },
});

export const { openSpecialtySheet, setSpecialtyForm, touchSpecialtyForm, loadSpecialtiesAsync, changeSpecialtyAsync } = specialtiesSlice.actions;
export const { selectAdminSpecialties } = specialtiesSlice.selectors;
