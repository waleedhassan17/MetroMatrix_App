// MetroMatrix — Kitchen: waste and Bachat Box. What went to waste and what
// it cost (7 or 30 days), tonight's boxes and the end-of-day suggestion,
// a pickup code collected at the counter, and spoken waste confirmed.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchWasteSummary, fetchWaste, logWaste } from '../../networks/kitchen/waste';
import { collectReservation, fetchBoxSuggestion, fetchBoxes } from '../../networks/kitchen/surplus';
import { toRejectedValue } from '../../networks/network/network';
import { normalizeCode } from '../../models/kitchen/surplusModel';
import { wasteFromVoice } from '../../models/kitchen/stockModel';
import type { SurplusBox, SurplusSuggestion, VoiceQtyLine, WasteEntry, WasteReason, WasteSummary } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { wasteSummarySerializer, wastePageSerializer, wasteSerializer } from '../../serializers/kitchen/wasteSerializer';
import { surplusBoxesSerializer, surplusSuggestionResponseSerializer, reservationSerializer } from '../../serializers/kitchen/surplusSerializer';

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
  /** The reservation just handed over. */
  collected: ReturnType<typeof reservationSerializer>;
  /** The waste just logged by voice. */
  logged: ReturnType<typeof wasteSerializer>;
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
  collected: null,

  logged: null,
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
          const [summary, recent, boxes, suggestion] = await Promise.all([fetchWasteSummary(range), fetchWaste(1, 5), fetchBoxes('live'), fetchBoxSuggestion()]);
          return { summary, recent, boxes, suggestion };
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
          state.summary = wasteSummarySerializer(action.payload.summary);
          state.recent = wastePageSerializer(action.payload.recent).items;
          state.boxes = surplusBoxesSerializer(action.payload.boxes);
          state.suggestion = surplusSuggestionResponseSerializer(action.payload.suggestion)?.suggestion ?? null;
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
          return await collectReservation(code);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.collecting = true;
          state.collectError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = reservationSerializer(action.payload);
          state.collecting = false;
          state.code = '';
          state.collected = payload;
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
          return await logWaste(wasteFromVoice(lines, reason));
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
          const payload = wasteSerializer(action.payload);
          state.logging = false;
          if (payload) state.recent = [payload, ...state.recent].slice(0, 5);
          state.logged = payload;
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
