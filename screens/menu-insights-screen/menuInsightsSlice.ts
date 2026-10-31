// MetroMatrix — Kitchen growth: menu insights. Every dish by how often it is
// ordered and what the kitchen keeps on it, with a suggestion; the kitchen's
// tests, and starting one (a price, or a new photo uploaded first).

import { createAppSlice } from '../../store/createAppSlice';
import { fetchMenuInsights, fetchExperiments, startExperiment } from '../../networks/foodGrowth/experiments';
import { uploadImage } from '../../services/mediaUpload';
import { toRejectedValue } from '../../networks/network/network';
import type { Experiment, ExperimentInput, MenuInsights } from '../../models';
import type { LocalFile } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { menuInsightsSerializer, experimentsSerializer, experimentSerializer } from '../../serializers/kitchen/reachSerializer';

export interface MenuInsightsSliceState {
  data: MenuInsights | null;
  experiments: Experiment[];
  status: FormStatus;
  error: ServerError;
  starting: boolean;
  startError: ServerError;
  /** The experiment just started. */
  started: ReturnType<typeof experimentSerializer>;
}

const initialState: MenuInsightsSliceState = { data: null, experiments: [], status: 'idle', error: NO_ERROR, starting: false, startError: NO_ERROR ,
  started: null,
};

export const menuInsightsSlice = createAppSlice({
  name: 'menuInsights',
  initialState,
  reducers: create => ({
    clearStartError: create.reducer(state => {
      state.startError = NO_ERROR;
    }),
    loadMenuInsightsAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          const [data, experiments] = await Promise.all([fetchMenuInsights(), fetchExperiments()]);
          return { data, experiments };
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
          const payload = { data: menuInsightsSerializer(action.payload.data), experiments: experimentsSerializer(action.payload.experiments) };
          state.status = 'succeeded';
          state.data = payload.data;
          state.experiments = payload.experiments;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Menu insights didn't load.");
        },
      },
    ),
    /** A price test, or a photo test with the new photo picked on the phone (uploaded first). */
    startExperimentAsync: create.asyncThunk(
      async (input: { itemId: string; days: number; change: { kind: 'price'; price: number } | { kind: 'photo'; file: LocalFile } }, { rejectWithValue }) => {
        try {
          const change: ExperimentInput['change'] =
            input.change.kind === 'price' ? input.change : { kind: 'photo', photoUrl: (await uploadImage(input.change.file, 'menu_item')).url };
          return await startExperiment({ itemId: input.itemId, days: input.days, change });
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.starting = true;
          state.startError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = experimentSerializer(action.payload);
          state.starting = false;
          if (!payload) return;
          state.experiments = [payload, ...state.experiments.filter(e => e.id !== payload.id)];
          const item = state.data?.items.find(i => i.itemId === payload.itemId);
          if (item) {
            item.experimentRunning = true;
            if (payload.change.kind === 'price') item.price = payload.change.price;
          }
          state.started = payload;
        },
        rejected: (state, action) => {
          state.starting = false;
          state.startError = readRejection(action, "The test didn't start.");
        },
      },
    ),
  }),
  selectors: {
    selectMenuInsights: state => state,
  },
});

export const { clearStartError, loadMenuInsightsAsync, startExperimentAsync } = menuInsightsSlice.actions;
export const { selectMenuInsights } = menuInsightsSlice.selectors;
