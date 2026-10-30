// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: deals
// ═══════════════════════════════════════════════════════
// Every deal the kitchen has made, newest first, with its state (live,
// starting later, ended, off) and how often it has been used.

import { createAppSlice } from '@store/createAppSlice';
import { getPromotionsAPI } from '@networks/food/vendor/promotionsNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { FoodPromotion } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { foodPromotionsSerializer } from '@serializers/food/orderSerializer';

export interface VendorPromotionsSliceState {
  items: FoodPromotion[];
  status: FormStatus;
  error: ServerError;
}

const initialState: VendorPromotionsSliceState = { items: [], status: 'idle', error: NO_ERROR };

export const vendorPromotionsSlice = createAppSlice({
  name: 'vendorPromotions',
  initialState,
  reducers: create => ({
    loadPromotionsAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(foodPromotionsSerializer(await getPromotionsAPI()));
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
          state.status = 'succeeded';
          state.items = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your deals didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorPromotions: state => state,
  },
});

export const { loadPromotionsAsync } = vendorPromotionsSlice.actions;
export const { selectVendorPromotions } = vendorPromotionsSlice.selectors;
