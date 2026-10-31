// MetroMatrix — Kitchen: waste and Bachat Box. What went to waste and what
// it cost (7 or 30 days), tonight's boxes and the end-of-day suggestion,
// a pickup code collected at the counter, and spoken waste confirmed.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../../store/createAppSlice';
import { getWasteSummaryAPI, getWasteAPI, logWasteAPI } from '../../../../networks/kitchen/wasteNetwork';
import { collectReservationAPI, getBoxSuggestionAPI, getBoxesAPI } from '../../../../networks/kitchen/surplusNetwork';
import { toRejectedValue, required } from '../../../../networks/network/apiHelpers';
import { normalizeCode } from '../../../../models/kitchen/surplusModel';
import { wasteFromVoice } from '../../../../models/kitchen/stockModel';
import type { SurplusBox, SurplusSuggestion, VoiceQtyLine, WasteEntry, WasteReason, WasteSummary } from '../../../../types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { wasteSummarySerializer, wastePageSerializer, wasteSerializer } from '../../../../serializers/kitchen/wasteSerializer';
import { surplusBoxesSerializer, surplusSuggestionResponseSerializer, reservationSerializer } from '../../../../serializers/kitchen/surplusSerializer';

export interface WasteAndSurplusSliceState {
  range: '7d' | '30d';
  summary: WasteSummary | null;
  recent: WasteEntry[];
  boxes: SurplusBox[];
  suggestion: SurplusSuggestion | null;
  status: FormStatus;
  error: ServerError;
  code: string;
  collecting: boolean;
  collectError: ServerError;
  logging: boolean;
  logError: ServerError;
}

const initialState: WasteAndSurplusSliceState = {
  range: '7d',
  summary: null,
  recent: [],
  boxes: [],
  suggestion: null,
  status: 'idle',
  error: NO_ERROR,
  code: '',
  collecting: false,
  collectError: NO_ERROR,
  logging: false,
  logError: NO_ERROR,
};

export const wasteAndSurplusSlice = createAppSlice({
  name: 'wasteAndSurplus',
  initialState,
  reducers: create => ({
    setWasteRange: create.reducer((state, action: PayloadAction<'7d' | '30d'>) => {
      state.range = action.payload;
    }),
    setPickupCode: create.reducer((state, action: PayloadAction<string>) => {
      state.code = action.payload;
      state.collectError = NO_ERROR;
    }),

    loadWasteAndSurplusAsync: create.asyncThunk(
      async (range: '7d' | '30d', { rejectWithValue }) => {
        try {
          const [summary, recent, live, suggestion] = await Promise.all([getWasteSummaryAPI(range).then(raw => required(wasteSummarySerializer(raw))), getWasteAPI(1, 5).then(raw => required(wastePageSerializer(raw))), getBoxesAPI('live').then(raw => required(surplusBoxesSerializer(raw))), getBoxSuggestionAPI().then(raw => required(surplusSuggestionResponseSerializer(raw)))]);
          return { summary, recent: recent.items, boxes: live, suggestion: suggestion.suggestion };
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
          state.summary = action.payload.summary;
          state.recent = action.payload.recent;
          state.boxes = action.payload.boxes;
          state.suggestion = action.payload.suggestion;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Waste and Bachat Box didn't load.");
        },
      },
    ),

    /** The customer reads their code out at the counter: the box is handed over. */
    collectByCodeAsync: create.asyncThunk(
      async (_: void, { getState, rejectWithValue }) => {
        const code = normalizeCode((getState() as { wasteAndSurplus: WasteAndSurplusSliceState }).wasteAndSurplus.code);
        try {
          return required(reservationSerializer(await collectReservationAPI(code)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.collecting = true;
          state.collectError = NO_ERROR;
        },
        fulfilled: state => {
          state.collecting = false;
          state.code = '';
        },
        rejected: (state, action) => {
          state.collecting = false;
          state.collectError = readRejection(action, "That code didn't go through.");
        },
      },
    ),

    logSpokenWasteAsync: create.asyncThunk(
      async ({ lines, reason }: { lines: VoiceQtyLine[]; reason: WasteReason }, { rejectWithValue }) => {
        try {
          return required(wasteSerializer(await logWasteAPI(wasteFromVoice(lines, reason))));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.logging = true;
          state.logError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.logging = false;
          if (action.payload) state.recent = [action.payload, ...state.recent].slice(0, 5);
        },
        rejected: (state, action) => {
          state.logging = false;
          state.logError = readRejection(action, "The waste didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectWasteAndSurplus: state => state,
  },
});

export const { setWasteRange, setPickupCode, loadWasteAndSurplusAsync, collectByCodeAsync, logSpokenWasteAsync } = wasteAndSurplusSlice.actions;
export const { selectWasteAndSurplus } = wasteAndSurplusSlice.selectors;
