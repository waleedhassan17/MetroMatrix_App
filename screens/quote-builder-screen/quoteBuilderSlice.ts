// MetroMatrix — Kitchen growth: a quote for a catering request. Starts from
// what was asked for at the menu's prices (or the last version's lines),
// edited line by line; checked by models/kitchen/cateringModel.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchCateringRequest, sendQuote } from '../../networks/foodGrowth/catering';
import { fetchMenuItems } from '../../networks/food/vendor/menu';
import { toRejectedValue, required } from '../../networks/network/network';
import { draftFromRequest, newDishKey, type QuoteDraft } from '../../models/kitchen/cateringModel';
import type { CateringRequest, QuoteInput, VendorMenuItem } from '../../models';
import type { ValidationErrors } from '../../models/authModel';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { vendorMenuItemsSerializer } from '../../serializers/food/menuSerializer';
import { cateringRequestSerializer } from '../../serializers/kitchen/growthSerializer';

export interface QuoteBuilderSliceState {
  code: string | null;
  request: CateringRequest | null;
  menu: Pick<VendorMenuItem, 'id' | 'name' | 'basePrice'>[];
  draft: QuoteDraft | null;
  errors: ValidationErrors;
  lineErrors: Record<string, string>;
  status: FormStatus;
  error: ServerError;
  sending: boolean;
  sendError: ServerError;
}

const initialState: QuoteBuilderSliceState = { code: null, request: null, menu: [], draft: null, errors: {}, lineErrors: {}, status: 'idle', error: NO_ERROR, sending: false, sendError: NO_ERROR };

type Line = QuoteDraft['lines'][number];

export const quoteBuilderSlice = createAppSlice({
  name: 'quoteBuilder',
  initialState,
  reducers: create => ({
    editQuote: create.reducer((state, action: PayloadAction<Partial<Omit<QuoteDraft, 'lines'>>>) => {
      if (state.draft) state.draft = { ...state.draft, ...action.payload };
      for (const k of Object.keys(action.payload)) delete state.errors[k];
    }),
    editQuoteLine: create.reducer((state, action: PayloadAction<{ key: string; patch: Partial<Omit<Line, 'key'>> }>) => {
      const l = state.draft?.lines.find(x => x.key === action.payload.key);
      if (l) Object.assign(l, action.payload.patch);
      delete state.lineErrors[action.payload.key];
    }),
    addQuoteLine: create.reducer((state, action: PayloadAction<{ itemId: string | null; name: string; unitPrice: number | null; qty: number }>) => {
      const p = action.payload;
      state.draft?.lines.push({ key: newDishKey(), itemId: p.itemId, name: p.name, qty: String(p.qty), unitPrice: p.unitPrice === null ? '' : String(p.unitPrice) });
      delete state.errors.lines;
    }),
    removeQuoteLine: create.reducer((state, action: PayloadAction<string>) => {
      if (state.draft) state.draft.lines = state.draft.lines.filter(l => l.key !== action.payload);
    }),
    setQuoteErrors: create.reducer((state, action: PayloadAction<{ errors: ValidationErrors; lineErrors: Record<string, string> }>) => {
      state.errors = action.payload.errors;
      state.lineErrors = action.payload.lineErrors;
    }),

    loadQuoteBuilderAsync: create.asyncThunk(
      async (code: string, { rejectWithValue }) => {
        try {
          const [request, menu] = await Promise.all([fetchCateringRequest(code).then(raw => required(cateringRequestSerializer(raw))), fetchMenuItems().then(raw => required(vendorMenuItemsSerializer(raw)))]);
          return { request, menu: menu.filter(i => i.isActive).map(i => ({ id: i.id, name: i.name, basePrice: i.basePrice })) };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.code = action.meta.arg;
          state.request = null;
          state.draft = null;
          state.errors = {};
          state.lineErrors = {};
          state.sendError = NO_ERROR;
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.request = action.payload.request;
          state.menu = action.payload.menu;
          if (action.payload.request) state.draft = draftFromRequest(action.payload.request, Object.fromEntries(action.payload.menu.map(m => [m.id, m.basePrice])));
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The request didn't load.");
        },
      },
    ),

    sendQuoteAsync: create.asyncThunk(
      async ({ code, input }: { code: string; input: QuoteInput }, { rejectWithValue }) => {
        try {
          return await sendQuote(code, input);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.sending = true;
          state.sendError = NO_ERROR;
        },
        fulfilled: state => {
          state.sending = false;
        },
        rejected: (state, action) => {
          state.sending = false;
          state.sendError = readRejection(action, "The quote didn't send.");
        },
      },
    ),
  }),
  selectors: {
    selectQuoteBuilder: state => state,
  },
});

export const { editQuote, editQuoteLine, addQuoteLine, removeQuoteLine, setQuoteErrors, loadQuoteBuilderAsync, sendQuoteAsync } = quoteBuilderSlice.actions;
export const { selectQuoteBuilder } = quoteBuilderSlice.selectors;
