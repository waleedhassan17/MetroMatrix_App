// ═══════════════════════════════════════════════════════
// MetroMatrix — Product detail slice (keyed by product)
// ═══════════════════════════════════════════════════════
// Keyed, because a product page opens related products on top of itself.
// Also the "Report this product" sheet. Adding to the Bag is the Bag
// slice's job (addToBagAsync).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchProduct, reportProduct } from '../../networks/shopping/catalog';
import { toRejectedValue, required } from '../../networks/network/network';
import type { ProductDetail } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { productDetailSerializer } from '../../serializers/shopping/catalogSerializer';

export interface ProductEntry {
  product: ProductDetail | null;
  status: FormStatus;
  error: ServerError;
}

export const REPORT_REASONS = [
  'Counterfeit or copy',
  'Misleading photos or description',
  'Prohibited item',
  'Offensive content',
  'Something else',
] as const;

export interface ProductDetailSliceState {
  byId: Record<string, ProductEntry>;
  /** The product whose variant sheet is open. */
  sheetFor: string | null;
  report: { productId: string | null; reason: string | null; details: string; status: FormStatus; error: ServerError };
}

const initialState: ProductDetailSliceState = {
  byId: {},
  sheetFor: null,
  report: { productId: null, reason: null, details: '', status: 'idle', error: NO_ERROR },
};

const EMPTY: ProductEntry = { product: null, status: 'idle', error: NO_ERROR };

export const productDetailSlice = createAppSlice({
  name: 'productDetail',
  initialState,
  reducers: create => ({
    openVariantSheet: create.reducer((state, action: PayloadAction<string>) => {
      state.sheetFor = action.payload;
    }),
    closeVariantSheet: create.reducer(state => {
      state.sheetFor = null;
    }),
    openReport: create.reducer((state, action: PayloadAction<string>) => {
      state.report = { productId: action.payload, reason: null, details: '', status: 'idle', error: NO_ERROR };
    }),
    closeReport: create.reducer(state => {
      state.report.productId = null;
    }),
    setReportReason: create.reducer((state, action: PayloadAction<string>) => {
      state.report.reason = action.payload;
    }),
    setReportDetails: create.reducer((state, action: PayloadAction<string>) => {
      state.report.details = action.payload;
    }),

    loadProductAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return required(productDetailSerializer(await fetchProduct(id)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const e = (state.byId[action.meta.arg] ??= { ...EMPTY });
          e.status = 'loading';
          e.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.byId[action.meta.arg] = { product: action.payload, status: 'succeeded', error: NO_ERROR };
        },
        rejected: (state, action) => {
          const e = (state.byId[action.meta.arg] ??= { ...EMPTY });
          e.status = 'failed';
          e.error = readRejection(action, "We couldn't open this product.");
        },
      },
    ),

    reportProductAsync: create.asyncThunk(
      async (input: { id: string; reason: string; details: string }, { rejectWithValue }) => {
        try {
          return await reportProduct(input.id, { reason: input.reason, details: input.details.trim() || null });
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.report.status = 'loading';
          state.report.error = NO_ERROR;
        },
        fulfilled: state => {
          state.report.status = 'succeeded';
          state.report.productId = null;
        },
        rejected: (state, action) => {
          state.report.status = 'failed';
          state.report.error = readRejection(action, "We couldn't send your report.");
        },
      },
    ),
  }),
  selectors: {
    selectProductEntry: (state, id: string): ProductEntry => state.byId[id] ?? EMPTY,
    selectVariantSheetFor: state => state.sheetFor,
    selectReport: state => state.report,
  },
});

export const {
  openVariantSheet,
  closeVariantSheet,
  openReport,
  closeReport,
  setReportReason,
  setReportDetails,
  loadProductAsync,
  reportProductAsync,
} = productDetailSlice.actions;
export const { selectProductEntry, selectVariantSheetFor, selectReport } = productDetailSlice.selectors;
