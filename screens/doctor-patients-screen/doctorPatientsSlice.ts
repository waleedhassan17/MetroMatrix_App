// MetroMatrix — Your patients: the search box (the list pages through usePagedList).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';

export interface DoctorPatientsSliceState {
  query: string;
}

const initialState: DoctorPatientsSliceState = { query: '' };

export const doctorPatientsSlice = createAppSlice({
  name: 'doctorPatients',
  initialState,
  reducers: create => ({
    setPatientQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.query = action.payload;
    }),
  }),
  selectors: {
    selectPatientQuery: state => state.query,
  },
});

export const { setPatientQuery } = doctorPatientsSlice.actions;
export const { selectPatientQuery } = doctorPatientsSlice.selectors;
