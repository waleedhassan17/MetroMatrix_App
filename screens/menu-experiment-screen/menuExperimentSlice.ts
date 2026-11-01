// MetroMatrix — Kitchen growth: one menu test. Its progress, its result, and
// the kitchen's decision (keep, adjust the price, go back, or stop early).

import { createAppSlice } from '../../store/createAppSlice';
import { cancelExperiment, endExperiment, fetchExperiment, updateExperiment } from '../../networks/foodGrowth/experiments';
import { updateMenuItem } from '../../networks/food/vendor/menu';
import { DECISION_NOTE, experimentNotes, type ExperimentDecision } from '../../models/kitchen/reachModel';
import { toRejectedValue } from '../../networks/network/network';
import type { Experiment } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { experimentSerializer } from '../../serializers/kitchen/reachSerializer';

export interface MenuExperimentSliceState {
  data: Experiment | null;
  status: FormStatus;
  error: ServerError;
  acting: boolean;
  actError: ServerError;
}

const initialState: MenuExperimentSliceState = { data: null, status: 'idle', error: NO_ERROR, acting: false, actError: NO_ERROR };

export const menuExperimentSlice = createAppSlice({
  name: 'menuExperiment',
  initialState,
  reducers: create => ({
    loadExperimentAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return await fetchExperiment(id);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.status = 'loading';
          state.error = NO_ERROR;
          state.actError = NO_ERROR;
          if (state.data?.id !== action.meta.arg) state.data = null;
        },
        fulfilled: (state, action) => {
          const payload = experimentSerializer(action.payload);
          state.status = 'succeeded';
          state.data = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The test didn't load.");
        },
      },
    ),
    decideExperimentAsync: create.asyncThunk(
      async ({ id, decision }: { id: string; decision: ExperimentDecision }, { getState, rejectWithValue }) => {
        const e = (getState() as { menuExperiment: MenuExperimentSliceState }).menuExperiment.data;
        if (!e || e.id !== id) return rejectWithValue({ message: 'Open the test again.', code: 'NOT_FOUND', details: null });
        try {
          // Stopping: ended (its result so far is kept), or called off before it has started.
          if (decision.kind === 'stop') {
            await (e.progress.daysIn > 0 ? endExperiment(id) : cancelExperiment(id));
            return await fetchExperiment(id);
          }
          // The dish changes through its own PATCH; the decision is written on the test.
          if (decision.kind === 'adjust') await updateMenuItem(e.itemId, { basePrice: decision.price });
          if (decision.kind === 'drop' && e.change.kind === 'price') await updateMenuItem(e.itemId, { basePrice: e.change.oldPrice });
          if (e.status === 'running' && e.progress.daysIn > 0) await endExperiment(id);
          return await updateExperiment(id, { notes: `${experimentNotes(e.change)} · ${DECISION_NOTE[decision.kind]}` });
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.acting = true;
          state.actError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = experimentSerializer(action.payload);
          state.acting = false;
          state.data = payload;
        },
        rejected: (state, action) => {
          state.acting = false;
          state.actError = readRejection(action, "That didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectMenuExperiment: state => state,
  },
});

export const { loadExperimentAsync, decideExperimentAsync } = menuExperimentSlice.actions;
export const { selectMenuExperiment } = menuExperimentSlice.selectors;
