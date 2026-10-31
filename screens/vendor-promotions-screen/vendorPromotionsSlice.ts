// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: deals
// ═══════════════════════════════════════════════════════
// Every deal the kitchen has made, newest first, with its state (live,
// starting later, ended, off) and how often it has been used.

import { createAppSlice } from '../../store/createAppSlice';
import { fetchPromotions } from '../../networks/food/vendor/promotions';
import { toRejectedValue, required } from '../../networks/network/network';
import type { FoodPromotion } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { foodPromotionsSerializer } from '../../serializers/food/orderSerializer';

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
          return await fetchPromotions();
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
          const payload = foodPromotionsSerializer(action.payload);
          state.status = 'succeeded';
          state.items = payload;
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
