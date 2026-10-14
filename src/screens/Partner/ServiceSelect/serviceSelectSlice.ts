// What the partner runs: a service, and for Food one of three kitchen types.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { SERVICE_SUBTYPES } from '@models/businessModel';
import type { ServiceType, SubType } from '@/types';

export interface ServiceSelectSliceState {
  serviceType: ServiceType | null;
  subType: SubType | null;
}

const initialState: ServiceSelectSliceState = { serviceType: null, subType: null };

export const serviceSelectSlice = createAppSlice({
  name: 'serviceSelect',
  initialState,
  reducers: create => ({
    chooseService: create.reducer((state, action: PayloadAction<ServiceType>) => {
      state.serviceType = action.payload;
      const subs = SERVICE_SUBTYPES[action.payload];
      // Shopping and healthcare have one sub-type; Food asks which kitchen.
      state.subType = subs.length === 1 ? subs[0] : state.subType && subs.includes(state.subType) ? state.subType : null;
    }),
    chooseSubType: create.reducer((state, action: PayloadAction<SubType>) => {
      state.subType = action.payload;
    }),
    preselect: create.reducer((state, action: PayloadAction<{ serviceType: ServiceType; subType: SubType }>) => {
      state.serviceType = action.payload.serviceType;
      state.subType = action.payload.subType;
    }),
  }),
  selectors: {
    selectServiceSelect: state => state,
  },
});

export const { chooseService, chooseSubType, preselect } = serviceSelectSlice.actions;
export const { selectServiceSelect } = serviceSelectSlice.selectors;
