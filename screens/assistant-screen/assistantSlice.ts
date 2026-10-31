// MetroMatrix — Kitchen: the assistant's home. How many actions are left this month.

import { createAppSlice } from '../../store/createAppSlice';
import { fetchAiUsage } from '../../networks/kitchen/kitchenAi';
import { toRejectedValue } from '../../networks/network/network';
import type { AiUsage } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { aiUsageSerializer } from '../../serializers/kitchen/insightSerializer';

export interface AssistantSliceState {
  usage: AiUsage | null;
  status: FormStatus;
  error: ServerError;
}

const initialState: AssistantSliceState = { usage: null, status: 'idle', error: NO_ERROR };

export const assistantSlice = createAppSlice({
  name: 'assistant',
  initialState,
  reducers: create => ({
    loadAssistantAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await fetchAiUsage();
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
          const payload = aiUsageSerializer(action.payload);
          state.status = 'succeeded';
          state.usage = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The assistant didn't load.");
        },
      },
    ),
  }),
  selectors: {
    selectAssistant: state => state,
  },
});

export const { loadAssistantAsync } = assistantSlice.actions;
export const { selectAssistant } = assistantSlice.selectors;
