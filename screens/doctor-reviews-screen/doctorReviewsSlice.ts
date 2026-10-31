// MetroMatrix — Doctor reviews filters: video or clinic, star count, sort.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import type { DoctorReviewSort } from '../../networks/health/reviews';
import type { ConsultKind } from '../../models';

export interface DoctorReviewsSliceState {
  kind: ConsultKind | null;
  rating: number | null;
  sort: DoctorReviewSort;
}

const initialState: DoctorReviewsSliceState = { kind: null, rating: null, sort: 'recent' };

export const doctorReviewsSlice = createAppSlice({
  name: 'doctorReviews',
  initialState,
  reducers: create => ({
    resetReviewFilters: create.reducer(() => initialState),
    setReviewKind: create.reducer((state, action: PayloadAction<ConsultKind | null>) => {
      state.kind = action.payload;
    }),
    setReviewRating: create.reducer((state, action: PayloadAction<number | null>) => {
      state.rating = action.payload;
    }),
    setReviewSort: create.reducer((state, action: PayloadAction<DoctorReviewSort>) => {
      state.sort = action.payload;
    }),
  }),
  selectors: {
    selectDoctorReviewFilters: state => state,
  },
});

export const { resetReviewFilters, setReviewKind, setReviewRating, setReviewSort } = doctorReviewsSlice.actions;
export const { selectDoctorReviewFilters } = doctorReviewsSlice.selectors;
