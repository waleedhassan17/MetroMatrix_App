// MetroMatrix — Admin reports slice: the queue filter and the decision sheet.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { dismissReport, removeReportedProduct } from '../../networks/admin/adminShop';
import { toRejectedValue, required } from '../../networks/network/network';
import type { ReportStatus } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { productReportSerializer } from '../../serializers/shopping/adminShopSerializer';

export interface ShopReportsSliceState {
  status: ReportStatus;
  removing: string | null;
  reason: string;
  busy: string | null;
  action: FormStatus;
  error: ServerError;
  /** The report just decided. */
  decided: ReturnType<typeof productReportSerializer>;
}

const initialState: ShopReportsSliceState = { status: 'open', removing: null, reason: '', busy: null, action: 'idle', error: NO_ERROR ,
  decided: null,
};

export const shopReportsSlice = createAppSlice({
  name: 'shopReports',
  initialState,
  reducers: create => ({
    setReportsStatus: create.reducer((state, action: PayloadAction<ReportStatus>) => {
      state.status = action.payload;
    }),
    openRemove: create.reducer((state, action: PayloadAction<string | null>) => {
      state.removing = action.payload;
      state.reason = '';
      state.error = NO_ERROR;
    }),
    setRemoveReason: create.reducer((state, action: PayloadAction<string>) => {
      state.reason = action.payload.slice(0, 300);
    }),
    decideReportAsync: create.asyncThunk(
      async (d: { id: string; kind: 'dismiss' } | { id: string; kind: 'remove'; reason: string }, { rejectWithValue }) => {
        try {
          return d.kind === 'dismiss' ? await dismissReport(d.id) : await removeReportedProduct(d.id, d.reason.trim());
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busy = action.meta.arg.id;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = productReportSerializer(action.payload);
          state.busy = null;
          state.removing = null;
          state.decided = payload;
        },
        rejected: (state, action) => {
          state.busy = null;
          state.error = readRejection(action, "That didn't go through.");
        },
      },
    ),
  }),
  selectors: {
    selectShopReports: state => state,
  },
});

export const { setReportsStatus, openRemove, setRemoveReason, decideReportAsync } = shopReportsSlice.actions;
export const { selectShopReports } = shopReportsSlice.selectors;
