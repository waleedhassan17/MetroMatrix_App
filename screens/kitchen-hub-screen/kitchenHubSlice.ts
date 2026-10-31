// MetroMatrix — Kitchen: the hub (the Kitchen tab). Its tiles' numbers, the
// insight cards and the assistant's meter, read together; a card snoozed
// leaves at once (the API keeps it away for a day).

import { createAppSlice } from '../../store/createAppSlice';
import { fetchInsightCards, fetchKitchenSummary, snoozeInsightCard } from '../../networks/kitchen/insightsCards';
import { fetchAiUsage } from '../../networks/kitchen/kitchenAi';
import { toRejectedValue, required } from '../../networks/network/network';
import type { AiUsage, InsightCard, KitchenSummary } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { snoozedCardSerializer, kitchenHubSerializer } from '../../serializers/kitchen/insightSerializer';

export interface KitchenHubSliceState {
  summary: KitchenSummary | null;
  cards: InsightCard[];
  usage: AiUsage | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: KitchenHubSliceState = { summary: null, cards: [], usage: null, status: 'idle', error: NO_ERROR };

export const kitchenHubSlice = createAppSlice({
  name: 'kitchenHub',
  initialState,
  reducers: create => ({
    loadKitchenHubAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          // The tiles, the cards and the assistant's meter, read together.
          const [summary, cards, usage] = await Promise.all([fetchKitchenSummary(), fetchInsightCards(), fetchAiUsage()]);
          return required(kitchenHubSerializer({ summary, cards, usage }));
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
          state.cards = action.payload.cards;
          state.usage = action.payload.usage;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The kitchen didn't load.");
        },
      },
    ),
    snoozeCardAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return required(snoozedCardSerializer(await snoozeInsightCard(id)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        // Gone at once; a failure brings nothing back (it shows again on the next read).
        pending: (state, action) => {
          state.cards = state.cards.filter(c => c.id !== action.meta.arg);
        },
      },
    ),
  }),
  selectors: {
    selectKitchenHub: state => state,
  },
});

export const { loadKitchenHubAsync, snoozeCardAsync } = kitchenHubSlice.actions;
export const { selectKitchenHub } = kitchenHubSlice.selectors;
