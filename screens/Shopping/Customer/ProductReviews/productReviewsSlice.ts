// MetroMatrix — Product reviews slice: the star and photo filters, per product.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../../store/createAppSlice';

export interface ReviewFilter {
  rating: number | null;
  withPhotos: boolean;
}

export interface ProductReviewsSliceState {
  byProduct: Record<string, ReviewFilter>;
}

const initialState: ProductReviewsSliceState = { byProduct: {} };
const NONE: ReviewFilter = { rating: null, withPhotos: false };

export const productReviewsSlice = createAppSlice({
  name: 'productReviews',
  initialState,
  reducers: create => ({
    setReviewRating: create.reducer((state, action: PayloadAction<{ productId: string; rating: number | null }>) => {
      const f = (state.byProduct[action.payload.productId] ??= { ...NONE });
      f.rating = action.payload.rating;
    }),
    setReviewPhotos: create.reducer((state, action: PayloadAction<{ productId: string; withPhotos: boolean }>) => {
      const f = (state.byProduct[action.payload.productId] ??= { ...NONE });
      f.withPhotos = action.payload.withPhotos;
    }),
  }),
  selectors: {
    selectReviewFilter: (state, productId: string): ReviewFilter => state.byProduct[productId] ?? NONE,
  },
});

export const { setReviewRating, setReviewPhotos } = productReviewsSlice.actions;
export const { selectReviewFilter } = productReviewsSlice.selectors;
