// MetroMatrix — the customer's nutrition settings (off by default). Other
// Food screens read `showCalories` from here: calories show only once the
// person turned them on.

import { createAppSlice } from '../../store/createAppSlice';
import { deleteNutritionProfile, fetchNutritionProfile, saveNutritionProfile } from '../../networks/myKitchen/nutrition';
import { toApiError, toRejectedValue } from '../../networks/network/network';
import type { NutritionSettings } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { nutritionSettingsSerializer } from '../../serializers/myKitchen/myKitchenSerializer';

export interface NutritionSettingsSliceState {
  settings: NutritionSettings | null;
  status: FormStatus;
  error: ServerError;
  saving: boolean;
  deleting: boolean;
  saveError: ServerError;
}

/** What the screen changes at once. */
export type NutritionPatch = Partial<Pick<NutritionSettings, 'enabled' | 'showCalories' | 'goal' | 'metrics' | 'manualTargetKcal'>>;

const OFF: NutritionSettings = { enabled: false, showCalories: false, goal: 'eat_better', metrics: null, manualTargetKcal: null, targetKcal: null, updatedAt: null };

const initialState: NutritionSettingsSliceState = { settings: null, status: 'idle', error: NO_ERROR, saving: false, deleting: false, saveError: NO_ERROR };

export const nutritionSettingsSlice = createAppSlice({
  name: 'nutritionSettings',
  initialState,
  reducers: create => ({
    loadNutritionSettingsAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await fetchNutritionProfile();
        } catch (e) {
          // No profile is nutrition off.
          if (toApiError(e).status === 404) return null;
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = nutritionSettingsSerializer(action.payload);
          state.status = 'succeeded';
          state.settings = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your nutrition settings didn't load.");
        },
      },
    ),
    saveNutritionAsync: create.asyncThunk(
      async (patch: NutritionPatch, { getState, rejectWithValue }) => {
        const was = (getState() as { nutritionSettings: NutritionSettingsSliceState }).nutritionSettings.settings;
        const next = { ...(was ?? OFF), ...patch };
        try {
          // Off is no profile at all; on is the whole profile (calories stay hidden until shown).
          if (!next.enabled) {
            if (was?.enabled) await deleteNutritionProfile();
            return null;
          }
          return await saveNutritionProfile({ goal: next.goal, metrics: next.metrics, manualTargetKcal: next.manualTargetKcal, showCalories: was?.enabled ? next.showCalories : !!patch.showCalories });
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
          state.saveError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = nutritionSettingsSerializer(action.payload);
          state.saving = false;
          state.settings = payload;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.saveError = readRejection(action, "That didn't save.");
        },
      },
    ),
    deleteNutritionAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          await deleteNutritionProfile();
          return null;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.deleting = true;
          state.saveError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = nutritionSettingsSerializer(action.payload);
          state.deleting = false;
          state.settings = payload;
        },
        rejected: (state, action) => {
          state.deleting = false;
          state.saveError = readRejection(action, "That wasn't deleted.");
        },
      },
    ),
  }),
  selectors: {
    selectNutritionSettings: state => state,
    selectShowCalories: state => !!state.settings?.showCalories,
  },
});

export const { loadNutritionSettingsAsync, saveNutritionAsync, deleteNutritionAsync } = nutritionSettingsSlice.actions;
export const { selectNutritionSettings, selectShowCalories } = nutritionSettingsSlice.selectors;
