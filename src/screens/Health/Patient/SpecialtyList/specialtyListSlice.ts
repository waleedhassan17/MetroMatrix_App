// MetroMatrix — All specialties (with doctor counts for the city) and a filter box.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { getSpecialtiesAPI } from '@networks/health/discoveryNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { Specialty } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { specialtiesSerializer } from '@serializers/health/discoverySerializer';

export interface SpecialtyListSliceState {
  items: Specialty[];
  query: string;
  status: FormStatus;
  error: ServerError;
}

const initialState: SpecialtyListSliceState = { items: [], query: '', status: 'idle', error: NO_ERROR };

export const specialtyListSlice = createAppSlice({
  name: 'specialtyList',
  initialState,
  reducers: create => ({
    setSpecialtyQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.query = action.payload;
    }),
    loadSpecialtiesAsync: create.asyncThunk(
      async (city: string | null, { rejectWithValue }) => {
        try {
          return required(specialtiesSerializer(await getSpecialtiesAPI(city)));
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
          state.items = action.payload;
          state.status = 'succeeded';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Specialties didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectSpecialtyList: state => state,
  },
});

export const { setSpecialtyQuery, loadSpecialtiesAsync } = specialtyListSlice.actions;
export const { selectSpecialtyList } = specialtyListSlice.selectors;
