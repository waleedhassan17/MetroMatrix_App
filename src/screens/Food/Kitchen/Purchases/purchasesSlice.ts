// MetroMatrix — Kitchen: purchases. The week's spend and the price watch
// (the list itself is paged: usePagedList), and a confirmed spoken purchase.

import { createAppSlice } from '@store/createAppSlice';
import { createPurchase, getPurchasesOverview } from '@networks/kitchen/purchasesNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { purchaseFromVoice } from '@models/kitchen/purchaseModel';
import type { PriceWatch, VoiceQtyLine } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

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
          return await getPurchasesOverview();
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
          return await createPurchase(purchaseFromVoice(lines));
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
