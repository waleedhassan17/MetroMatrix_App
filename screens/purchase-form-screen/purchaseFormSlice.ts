// MetroMatrix — Kitchen: a new purchase. Draft lines (typed, scanned from a
// receipt or spoken), the supplier and the day; the cook checks every line
// before saving. A scan or a voice entry only fills the draft.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { createPurchase, fetchSuppliers } from '../../networks/kitchen/purchases';
import { fetchStock } from '../../networks/kitchen/stock';
import { scanReceipt } from '../../networks/kitchen/kitchenAi';
import { uploadImage } from '../../services/mediaUpload';
import { toRejectedValue, required } from '../../networks/network/network';
import { emptyLine, linesFromReceipt, linesFromVoice, type DraftLine } from '../../models/kitchen/purchaseModel';
import type { Ingredient, LocalFile, PurchaseInput, PurchaseSource, Supplier, VoiceQtyLine } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { stockListSerializer, suppliersSerializer, purchaseSerializer } from '../../serializers/kitchen/stockSerializer';
import { receiptDraftSerializer } from '../../serializers/kitchen/insightSerializer';

export interface PurchaseFormSliceState {
  source: PurchaseSource;
  lines: DraftLine[];
  supplierId: string | null;
  supplierName: string;
  /** 0 = today, 1 = yesterday … */
  daysAgo: number;
  receiptUrl: string | null;
  ingredients: Ingredient[];
  suppliers: Supplier[];
  status: FormStatus;
  scanning: boolean;
  scanError: ServerError;
  saving: boolean;
  error: ServerError;
  lineErrors: Record<string, string>;
  /** The purchase just saved. */
  saved: ReturnType<typeof purchaseSerializer>;
}

const initialState: PurchaseFormSliceState = {
  source: 'manual',
  lines: [emptyLine()],
  supplierId: null,
  supplierName: '',
  daysAgo: 0,
  receiptUrl: null,
  ingredients: [],
  suppliers: [],
  status: 'idle',
  scanning: false,
  scanError: NO_ERROR,
  saving: false,
  error: NO_ERROR,
  lineErrors: {},
  saved: null,
};

const isBlank = (l: DraftLine) => !l.ingredientId && !l.name.trim() && !l.qty.trim() && !l.total.trim();

export const purchaseFormSlice = createAppSlice({
  name: 'purchaseForm',
  initialState,
  reducers: create => ({
    /** A fresh form; spoken lines (Edit on a voice card) fill it. */
    startPurchaseForm: create.reducer((_state, action: PayloadAction<VoiceQtyLine[] | undefined>) => ({
      ...initialState,
      lines: action.payload?.length ? linesFromVoice(action.payload) : [emptyLine()],
      source: action.payload?.length ? ('voice' as PurchaseSource) : ('manual' as PurchaseSource),
    })),
    addPurchaseLine: create.reducer(state => {
      state.lines.push(emptyLine());
    }),
    updatePurchaseLine: create.reducer((state, action: PayloadAction<{ key: string; patch: Partial<DraftLine> }>) => {
      const l = state.lines.find(x => x.key === action.payload.key);
      if (l) Object.assign(l, action.payload.patch);
      delete state.lineErrors[action.payload.key];
    }),
    removePurchaseLine: create.reducer((state, action: PayloadAction<string>) => {
      state.lines = state.lines.filter(l => l.key !== action.payload);
      if (!state.lines.length) state.lines.push(emptyLine());
    }),
    /** Spoken lines join the draft (the blank starter line goes). */
    addSpokenLines: create.reducer((state, action: PayloadAction<VoiceQtyLine[]>) => {
      state.lines = [...state.lines.filter(l => !isBlank(l)), ...linesFromVoice(action.payload)];
      if (state.source === 'manual') state.source = 'voice';
    }),
    setSupplier: create.reducer((state, action: PayloadAction<{ id: string | null; name?: string }>) => {
      state.supplierId = action.payload.id;
      if (action.payload.name !== undefined) state.supplierName = action.payload.name.slice(0, 80);
    }),
    setDaysAgo: create.reducer((state, action: PayloadAction<number>) => {
      state.daysAgo = action.payload;
    }),
    setPurchaseLineErrors: create.reducer((state, action: PayloadAction<Record<string, string>>) => {
      state.lineErrors = action.payload;
    }),
    loadPurchaseFormAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          const [stock, suppliers] = await Promise.all([fetchStock('all', '').then(raw => required(stockListSerializer(raw))), fetchSuppliers().then(raw => required(suppliersSerializer(raw)))]);
          return { ingredients: stock.items, suppliers };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.ingredients = action.payload.ingredients;
          state.suppliers = action.payload.suppliers;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your stock didn't load.");
        },
      },
    ),
    /** The receipt photo is uploaded and read; its lines fill the draft. */
    scanReceiptAsync: create.asyncThunk(
      async (file: LocalFile, { rejectWithValue }) => {
        try {
          const uploaded = await uploadImage(file, 'kitchen_receipt');
          return await scanReceipt(uploaded.url);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.scanning = true;
          state.scanError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = receiptDraftSerializer(action.payload);
          state.scanning = false;
          state.source = 'receipt';
          if (!payload) return;
          state.receiptUrl = payload.imageUrl;
          state.lines = [...state.lines.filter(l => !isBlank(l)), ...linesFromReceipt(payload)];
          const known = state.suppliers.find(s => s.name.toLowerCase() === (payload.supplierName ?? '').toLowerCase());
          if (known) state.supplierId = known.id;
          else if (payload.supplierName && !state.supplierId) state.supplierName = payload.supplierName;
        },
        rejected: (state, action) => {
          state.scanning = false;
          state.scanError = readRejection(action, "The receipt couldn't be read. Type the lines instead.");
        },
      },
    ),
    savePurchaseAsync: create.asyncThunk(
      async (input: PurchaseInput, { rejectWithValue }) => {
        try {
          return await createPurchase(input);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = purchaseSerializer(action.payload);
          state.saving = false;
          state.saved = payload;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "The purchase didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectPurchaseForm: state => state,
  },
});

export const {
  startPurchaseForm,
  addPurchaseLine,
  updatePurchaseLine,
  removePurchaseLine,
  addSpokenLines,
  setSupplier,
  setDaysAgo,
  setPurchaseLineErrors,
  loadPurchaseFormAsync,
  scanReceiptAsync,
  savePurchaseAsync,
} = purchaseFormSlice.actions;
export const { selectPurchaseForm } = purchaseFormSlice.selectors;
