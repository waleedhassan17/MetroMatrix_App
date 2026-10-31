// MetroMatrix — the customer's nutrition settings (off by default). Other
// Food screens read `showCalories` from here: calories show only once the
// person turned them on.

import { createAppSlice } from '../../store/createAppSlice';
import { deleteNutritionData, fetchNutritionSettings, saveNutritionSettings } from '../../networks/myKitchen/nutrition';
import { toRejectedValue, required } from '../../networks/network/network';
import type { NutritionSettings } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { nutritionSettingsSerializer, nutritionSettingsResponseSerializer } from '../../serializers/myKitchen/myKitchenSerializer';

export interface NutritionSettingsSliceState {
  settings: NutritionSettings | null;
  status: FormStatus;
  error: ServerError;
  saving: boolean;
  deleting: boolean;
  saveError: ServerError;
}

const initialState: NutritionSettingsSliceState = { settings: null, status: 'idle', error: NO_ERROR, saving: false, deleting: false, saveError: NO_ERROR };

export const nutritionSettingsSlice = createAppSlice({
  name: 'nutritionSettings',
  initialState,
  reducers: create => ({
    loadNutritionSettingsAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(nutritionSettingsSerializer(await fetchNutritionSettings()));
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
          state.settings = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your nutrition settings didn't load.");
        },
      },
    ),
    saveNutritionAsync: create.asyncThunk(
      async (patch: Parameters<typeof saveNutritionSettings>[0], { rejectWithValue }) => {
        try {
          return required(nutritionSettingsSerializer(await saveNutritionSettings(patch)));
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
          state.saving = false;
          state.settings = action.payload;
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
          return required(nutritionSettingsResponseSerializer(await deleteNutritionData()));
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
          state.deleting = false;
          state.settings = action.payload;
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
