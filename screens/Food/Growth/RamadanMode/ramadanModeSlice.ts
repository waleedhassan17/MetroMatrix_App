// MetroMatrix — Kitchen growth: Ramadan mode. The event's dates, whether the
// kitchen keeps Ramadan hours, and its sehri and iftar windows.

import { createAppSlice } from '../../../../store/createAppSlice';
import { getRamadanAPI, updateRamadanAPI } from '../../../../networks/foodGrowth/ramadanNetwork';
import { toRejectedValue, required } from '../../../../networks/network/apiHelpers';
import type { RamadanInput, RamadanSettings } from '../../../../types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { ramadanSettingsSerializer } from '../../../../serializers/kitchen/reachSerializer';

export interface RamadanModeSliceState {
  data: RamadanSettings | null;
  status: FormStatus;
  error: ServerError;
  saving: boolean;
  saveError: ServerError;
}

const initialState: RamadanModeSliceState = { data: null, status: 'idle', error: NO_ERROR, saving: false, saveError: NO_ERROR };

export const ramadanModeSlice = createAppSlice({
  name: 'ramadanMode',
  initialState,
  reducers: create => ({
    loadRamadanAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(ramadanSettingsSerializer(await getRamadanAPI()));
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
          state.data = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Ramadan mode didn't load.");
        },
      },
    ),
    saveRamadanAsync: create.asyncThunk(
      async (input: RamadanInput, { rejectWithValue }) => {
        try {
          return required(ramadanSettingsSerializer(await updateRamadanAPI(input)));
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
          state.data = action.payload;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.saveError = readRejection(action, "That didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectRamadanMode: state => state,
  },
});

export const { loadRamadanAsync, saveRamadanAsync } = ramadanModeSlice.actions;
export const { selectRamadanMode } = ramadanModeSlice.selectors;
