// What the provider runs — the FYP's Provider Selection, on MetroMatrix's
// services: Doctor, Food (Restaurant / Home kitchen / Cloud kitchen), Vendor.
// The choice travels with the provider sign-up (and labels the badge).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { ServiceType, SubType } from '@/types';

export interface ProviderSelectionSliceState {
  serviceType: ServiceType | null;
  subType: SubType | null;
  /** Food's card shows its three kitchen types while expanded. */
  expanded: boolean;
}

const initialState: ProviderSelectionSliceState = { serviceType: null, subType: null, expanded: false };

export const providerSelectionSlice = createAppSlice({
  name: 'providerSelection',
  initialState,
  reducers: create => ({
    chooseService: create.reducer((state, action: PayloadAction<ServiceType>) => {
      const service = action.payload;
      if (service === 'food') {
        // Toggle the kitchen list; keep a kitchen already chosen.
        state.expanded = !(state.serviceType === 'food' && state.expanded);
        if (state.serviceType !== 'food') state.subType = null;
        state.serviceType = 'food';
        return;
      }
      state.serviceType = service;
      state.subType = service === 'healthcare' ? 'doctor' : 'store';
      state.expanded = false;
    }),
    chooseKitchen: create.reducer((state, action: PayloadAction<SubType>) => {
      state.serviceType = 'food';
      state.subType = action.payload;
      state.expanded = false;
    }),
  }),
  selectors: {
    selectProviderSelection: state => state,
    selectProviderSubType: state => state.subType,
  },
});

export const { chooseService, chooseKitchen } = providerSelectionSlice.actions;
export const { selectProviderSelection, selectProviderSubType } = providerSelectionSlice.selectors;
