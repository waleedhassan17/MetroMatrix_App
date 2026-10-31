// MetroMatrix — Kitchen settings: the food-cost target, selling a dish out
// when stock can't make it, and the packing photo before ready. (Spoken
// announcements are this device's: preferences.)

import { createAppSlice } from '../../store/createAppSlice';
import { fetchKitchenSettings, updateKitchenSettings } from '../../networks/kitchen/costing';
import { toRejectedValue, required } from '../../networks/network/network';
import type { KitchenSettings } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { kitchenSettingsSerializer } from '../../serializers/kitchen/recipeSerializer';

export interface KitchenSettingsSliceState {
  settings: KitchenSettings | null;
  status: FormStatus;
  saving: boolean;
  error: ServerError;
}

const initialState: KitchenSettingsSliceState = { settings: null, status: 'idle', saving: false, error: NO_ERROR };

export const kitchenSettingsSlice = createAppSlice({
  name: 'kitchenSettings',
  initialState,
  reducers: create => ({
    loadKitchenSettingsAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await fetchKitchenSettings();
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
          const payload = kitchenSettingsSerializer(action.payload);
          state.status = 'succeeded';
          state.settings = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your settings didn't load.");
        },
      },
    ),
    saveKitchenSettingsAsync: create.asyncThunk(
      async (patch: Partial<KitchenSettings>, { rejectWithValue }) => {
        try {
          return await updateKitchenSettings(patch);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        // Shown at once; the server's answer replaces it (or the error puts it back on reload).
        pending: (state, action) => {
          state.saving = true;
          state.error = NO_ERROR;
          if (state.settings) Object.assign(state.settings, action.meta.arg);
        },
        fulfilled: (state, action) => {
          const payload = kitchenSettingsSerializer(action.payload);
          state.saving = false;
          state.settings = payload;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "That setting didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectKitchenSettings: state => state,
  },
});

export const { loadKitchenSettingsAsync, saveKitchenSettingsAsync } = kitchenSettingsSlice.actions;
export const { selectKitchenSettings } = kitchenSettingsSlice.selectors;
