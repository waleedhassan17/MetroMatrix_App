// MetroMatrix — Kitchen: stock. A segment (all, running low, expiring,
// below zero) and a search over the ingredients, and what a confirmed voice
// entry does here: a purchase, waste or a count, through the ordinary
// endpoints (the voice card itself never writes).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchStock, recordStockTake } from '../../networks/kitchen/stock';
import { createPurchase } from '../../networks/kitchen/purchases';
import { logWaste } from '../../networks/kitchen/waste';
import { toRejectedValue, required } from '../../networks/network/network';
import { purchaseFromVoice } from '../../models/kitchen/purchaseModel';
import { countFromVoice, wasteFromVoice } from '../../models/kitchen/stockModel';
import type { StockList, StockSegment, VoiceAction } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { stockListSerializer, purchaseSerializer, stockTakeSerializer } from '../../serializers/kitchen/stockSerializer';

export interface StockSliceState {
  segment: StockSegment;
  q: string;
  list: StockList | null;
  status: FormStatus;
  error: ServerError;
  /** A confirmed voice entry is being saved. */
  confirming: boolean;
  confirmError: ServerError;
}

const initialState: StockSliceState = { segment: 'all', q: '', list: null, status: 'idle', error: NO_ERROR, confirming: false, confirmError: NO_ERROR };

export const stockSlice = createAppSlice({
  name: 'stock',
  initialState,
  reducers: create => ({
    setStockSegment: create.reducer((state, action: PayloadAction<StockSegment>) => {
      state.segment = action.payload;
    }),
    setStockQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.q = action.payload.slice(0, 60);
    }),
    loadStockAsync: create.asyncThunk(
      async ({ segment, q }: { segment: StockSegment; q: string }, { rejectWithValue }) => {
        try {
          return required(stockListSerializer(await fetchStock(segment, q)));
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
          state.list = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your stock didn't load.");
        },
      },
    ),
    /** A confirmed voice card on Stock: a purchase, waste or a count. Resolves to what it did. */
    confirmStockVoiceAsync: create.asyncThunk(
      async (action: VoiceAction, { rejectWithValue }) => {
        try {
          if (action.kind === 'purchase.add') {
            const p = required(purchaseSerializer(await createPurchase(purchaseFromVoice(action.lines))));
            return `Purchase saved: ${p.lines.length} ${p.lines.length === 1 ? 'item' : 'items'}.`;
          }
          if (action.kind === 'waste.log') {
            const lines = wasteFromVoice(action.lines, action.reason);
            if (!lines.length) throw new Error('Add that ingredient to your stock first.');
            await logWaste(lines);
            return 'Waste logged.';
          }
          if (action.kind === 'stock.count') {
            const lines = countFromVoice(action.lines);
            if (!lines.length) throw new Error('Add that ingredient to your stock first.');
            const r = required(stockTakeSerializer(await recordStockTake(lines)));
            return r.adjusted ? `Stock count saved: ${r.adjusted} changed.` : 'Stock count saved: it matched.';
          }
          throw new Error('That isn’t something Stock can do. Try the board or Today.');
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
        },
        rejected: (state, action) => {
          state.confirming = false;
          state.confirmError = readRejection(action, "That didn't save. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectStock: state => state,
  },
});

export const { setStockSegment, setStockQuery, loadStockAsync, confirmStockVoiceAsync } = stockSlice.actions;
export const { selectStock } = stockSlice.selectors;
