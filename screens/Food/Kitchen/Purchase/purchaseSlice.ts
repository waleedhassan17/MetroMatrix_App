// MetroMatrix — Kitchen: one purchase (its lines, supplier and receipt).

import { createAppSlice } from '../../../../store/createAppSlice';
import { getPurchaseAPI } from '../../../../networks/kitchen/purchasesNetwork';
import { toRejectedValue, required } from '../../../../networks/network/apiHelpers';
import type { Purchase } from '../../../../types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { purchaseSerializer } from '../../../../serializers/kitchen/stockSerializer';

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
          return required(purchaseSerializer(await getPurchaseAPI(id)));
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
          state.status = 'succeeded';
          state.purchase = action.payload;
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
