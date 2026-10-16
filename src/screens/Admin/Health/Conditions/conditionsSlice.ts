// MetroMatrix — Admin conditions slice: search, the list, the specialties
// a condition can lead to, and the add/edit sheet.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { createCondition, deleteCondition, listAdminConditions, listAdminSpecialties, updateCondition } from '@networks/admin/adminHealthNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { conditionInput, type ConditionForm } from '@models/health/adminHealthModel';
import type { AdminCondition, AdminSpecialty } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export interface ConditionsSliceState {
  query: string;
  list: AdminCondition[];
  specialties: AdminSpecialty[];
  status: FormStatus;
  busy: boolean;
  error: ServerError;
  sheet: ConditionForm | null;
  touched: boolean;
}

const initialState: ConditionsSliceState = {
  query: '',
  list: [],
  specialties: [],
  status: 'idle',
  busy: false,
  error: NO_ERROR,
  sheet: null,
  touched: false,
};

type Change = { kind: 'save'; form: ConditionForm; query: string } | { kind: 'delete'; id: string; query: string };

export const conditionsSlice = createAppSlice({
  name: 'adminConditions',
  initialState,
  reducers: create => ({
    setConditionQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.query = action.payload.slice(0, 60);
    }),
    openConditionSheet: create.reducer((state, action: PayloadAction<ConditionForm | null>) => {
      state.sheet = action.payload;
      state.touched = false;
      state.error = NO_ERROR;
    }),
    setConditionForm: create.reducer((state, action: PayloadAction<Partial<ConditionForm>>) => {
      if (state.sheet) state.sheet = { ...state.sheet, ...action.payload };
    }),
    touchConditionForm: create.reducer(state => {
      state.touched = true;
    }),
    loadConditionsAsync: create.asyncThunk(
      async (q: string, { getState, rejectWithValue }) => {
        try {
          const known = (getState() as { adminConditions: ConditionsSliceState }).adminConditions.specialties;
          const [list, specialties] = await Promise.all([listAdminConditions(q.trim()), known.length ? Promise.resolve(known) : listAdminSpecialties()]);
          return { list, specialties };
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
          state.list = action.payload.list;
          state.specialties = action.payload.specialties;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't load the conditions.");
        },
      },
    ),
    changeConditionAsync: create.asyncThunk(
      async (change: Change, { rejectWithValue }) => {
        try {
          if (change.kind === 'save') {
            const input = conditionInput(change.form);
            await (change.form.id ? updateCondition(change.form.id, input) : createCondition(input));
          } else await deleteCondition(change.id);
          return await listAdminConditions(change.query.trim());
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
    selectAdminConditions: state => state,
  },
});

export const {
  setConditionQuery,
  openConditionSheet,
  setConditionForm,
  touchConditionForm,
  loadConditionsAsync,
  changeConditionAsync,
} = conditionsSlice.actions;
export const { selectAdminConditions } = conditionsSlice.selectors;
