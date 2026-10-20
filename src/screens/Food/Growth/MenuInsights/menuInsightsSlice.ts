// MetroMatrix — Kitchen growth: menu insights. Every dish by how often it is
// ordered and what the kitchen keeps on it, with a suggestion; the kitchen's
// tests, and starting one (a price, or a new photo uploaded first).

import { createAppSlice } from '@store/createAppSlice';
import { getMenuInsights, listExperiments, startExperiment } from '@networks/foodGrowth/experimentsNetwork';
import { uploadImage } from '@networks/media/mediaNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { Experiment, ExperimentInput, MenuInsights } from '@/types';
import type { LocalFile } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';

export interface MenuInsightsSliceState {
  data: MenuInsights | null;
  experiments: Experiment[];
  status: FormStatus;
  error: ServerError;
  starting: boolean;
  startError: ServerError;
}

const initialState: MenuInsightsSliceState = { data: null, experiments: [], status: 'idle', error: NO_ERROR, starting: false, startError: NO_ERROR };

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
          const [data, experiments] = await Promise.all([getMenuInsights(), listExperiments()]);
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
          state.status = 'succeeded';
          state.data = action.payload.data;
          state.experiments = action.payload.experiments;
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
          state.starting = false;
          state.experiments = [action.payload, ...state.experiments.filter(e => e.id !== action.payload.id)];
          const item = state.data?.items.find(i => i.itemId === action.payload.itemId);
          if (item) {
            item.experimentRunning = true;
            if (action.payload.change.kind === 'price') item.price = action.payload.change.price;
          }
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
