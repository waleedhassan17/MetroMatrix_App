// MetroMatrix — Kitchen: one purchase (its lines, supplier and receipt).

import { createAppSlice } from '../../store/createAppSlice';
import { fetchPurchase } from '../../networks/kitchen/purchases';
import { toRejectedValue } from '../../networks/network/network';
import type { Purchase } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { purchaseSerializer } from '../../serializers/kitchen/stockSerializer';

export interface PurchaseSliceState {
  purchase: Purchase | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: PurchaseSliceState = { purchase: null, status: 'idle', error: NO_ERROR };

export const purchaseSlice = createAppSlice({
  name: 'purchase',
  initialState,
  reducers: create => ({
    loadPurchaseAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return await fetchPurchase(id);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.status = 'loading';
          state.error = NO_ERROR;
          if (state.purchase?.id !== action.meta.arg) state.purchase = null;
        },
        fulfilled: (state, action) => {
          const payload = purchaseSerializer(action.payload);
          state.status = 'succeeded';
          state.purchase = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "This purchase didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectPurchase: state => state,
  },
});

export const { loadPurchaseAsync } = purchaseSlice.actions;
export const { selectPurchase } = purchaseSlice.selectors;
