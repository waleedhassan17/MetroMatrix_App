// MetroMatrix — Kitchen growth: one menu test. Its progress, its result, and
// the kitchen's decision (keep, adjust the price, go back, or stop early).

import { createAppSlice } from '../../../../store/createAppSlice';
import { decideExperimentAPI, getExperimentAPI, type ExperimentDecision } from '../../../../networks/foodGrowth/experimentsNetwork';
import { toRejectedValue, required } from '../../../../networks/network/apiHelpers';
import type { Experiment } from '../../../../types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { experimentSerializer } from '../../../../serializers/kitchen/reachSerializer';

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
          return required(experimentSerializer(await getExperimentAPI(id)));
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
          state.status = 'succeeded';
          state.data = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The test didn't load.");
        },
      },
    ),
    decideExperimentAsync: create.asyncThunk(
      async ({ id, decision }: { id: string; decision: ExperimentDecision }, { rejectWithValue }) => {
        try {
          return required(experimentSerializer(await decideExperimentAPI(id, decision)));
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
          state.acting = false;
          state.data = action.payload;
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
