// MetroMatrix — Kitchen: purchases. The week's spend and the price watch
// (the list itself is paged: usePagedList), and a confirmed spoken purchase.

import { createAppSlice } from '../../store/createAppSlice';
import { createPurchase, fetchPriceWatch, fetchPurchases } from '../../networks/kitchen/purchases';
import { toRejectedValue, required } from '../../networks/network/network';
import { purchaseFromVoice } from '../../models/kitchen/purchaseModel';
import type { PriceWatch, VoiceQtyLine } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { purchaseSerializer, purchasesOverviewSerializer } from '../../serializers/kitchen/stockSerializer';

export interface PurchasesSliceState {
  weekTotal: number | null;
  watch: PriceWatch | null;
  status: FormStatus;
  error: ServerError;
  confirming: boolean;
  confirmError: ServerError;
  /** Bumped after a purchase is saved here: the list reloads. */
  version: number;
}

const initialState: PurchasesSliceState = { weekTotal: null, watch: null, status: 'idle', error: NO_ERROR, confirming: false, confirmError: NO_ERROR, version: 0 };

export const purchasesSlice = createAppSlice({
  name: 'purchases',
  initialState,
  reducers: create => ({
    loadPurchasesOverviewAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          // This week's spend rides on the first page; the price watch beside it.
          const [first, watch] = await Promise.all([fetchPurchases(1, 1), fetchPriceWatch()]);
          return required(purchasesOverviewSerializer({ first, watch }));
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
          state.weekTotal = action.payload.weekTotal;
          state.watch = action.payload.watch;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Purchases didn't load.");
        },
      },
    ),
    confirmSpokenPurchaseAsync: create.asyncThunk(
      async (lines: VoiceQtyLine[], { rejectWithValue }) => {
        try {
          return required(purchaseSerializer(await createPurchase(purchaseFromVoice(lines))));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.confirming = true;
          state.confirmError = NO_ERROR;
        },
        fulfilled: state => {
          state.confirming = false;
          state.version += 1;
        },
        rejected: (state, action) => {
          state.confirming = false;
          state.confirmError = readRejection(action, "The purchase didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectPurchases: state => state,
  },
});

export const { loadPurchasesOverviewAsync, confirmSpokenPurchaseAsync } = purchasesSlice.actions;
export const { selectPurchases } = purchasesSlice.selectors;
