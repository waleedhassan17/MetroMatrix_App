// Dev-only: which service accent the gallery previews. Theme MODE is not here
// — the gallery flips the real `preferences.themeMode`, so what you see is
// exactly what every screen gets.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { ServiceName } from '@theme/services';

export interface DesignGallerySliceState {
  previewService: ServiceName;
}

const initialState: DesignGallerySliceState = {
  previewService: 'neutral',
};

export const designGallerySlice = createAppSlice({
  name: 'designGallery',
  initialState,
  reducers: create => ({
    setPreviewService: create.reducer((state, action: PayloadAction<ServiceName>) => {
      state.previewService = action.payload;
    }),
  }),
  selectors: {
    selectPreviewService: state => state.previewService,
  },
});

export const { setPreviewService } = designGallerySlice.actions;
export const { selectPreviewService } = designGallerySlice.selectors;
