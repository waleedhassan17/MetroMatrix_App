// Which onboarding page is showing. Finishing (Skip or Get started) sets the
// global, persisted auth.hasSeenOnboarding — not this slice.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';

export interface OnboardingSliceState {
  page: number;
}

const initialState: OnboardingSliceState = { page: 0 };

export const onboardingSlice = createAppSlice({
  name: 'onboarding',
  initialState,
  reducers: create => ({
    setPage: create.reducer((state, action: PayloadAction<number>) => {
      state.page = action.payload;
    }),
  }),
  selectors: {
    selectOnboardingPage: state => state.page,
  },
});

export const { setPage } = onboardingSlice.actions;
export const { selectOnboardingPage } = onboardingSlice.selectors;
