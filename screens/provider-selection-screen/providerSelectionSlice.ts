// What the provider runs — the FYP's Provider Selection, on MetroMatrix's
// services: Doctor, Food (Restaurant / Home kitchen / Cloud kitchen), Vendor.
// The choice labels the sign-up badge. The API doesn't keep it on the account
// (it arrives with the business, POST /businesses), so a successful provider
// sign-up records it as `pending`, which is persisted so PersonalInfo still
// has it after a cold restart.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { resetAllState } from '../../store/resetAllState';
import type { ServiceType, SubType } from '../../models';

export interface ProviderPick {
  serviceType: ServiceType;
  subType: SubType;
}

export interface ProviderSelectionSliceState {
  serviceType: ServiceType | null;
  subType: SubType | null;
  /** Food's card shows its three kitchen types while expanded. */
  expanded: boolean;
  /** The pick a new provider signed up with, until their business exists. */
  pending: ProviderPick | null;
}

const initialState: ProviderSelectionSliceState = { serviceType: null, subType: null, expanded: false, pending: null };

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
    rememberPendingPick: create.reducer((state, action: PayloadAction<ProviderPick>) => {
      state.pending = action.payload;
    }),
  }),

  // Kept through store.ts's reset (so its persist marker survives) and
  // cleared here: the pick belongs to the account that made it.
  extraReducers: builder => {
    builder.addCase(resetAllState, () => initialState);
  },

  selectors: {
    selectProviderSelection: state => state,
    selectProviderSubType: state => state.subType,
    selectPendingPick: state => state.pending,
  },
});

export const { chooseService, chooseKitchen, rememberPendingPick } = providerSelectionSlice.actions;
export const { selectProviderSelection, selectProviderSubType, selectPendingPick } = providerSelectionSlice.selectors;
