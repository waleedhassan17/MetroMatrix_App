// MetroMatrix — Kitchen growth: Ramadan mode. The event's dates, whether the
// kitchen keeps Ramadan hours, and its sehri and iftar windows.

import { createAppSlice } from '../../store/createAppSlice';
import { fetchRamadan, updateRamadan } from '../../networks/foodGrowth/ramadan';
import { toRejectedValue } from '../../networks/network/network';
import type { RamadanInput, RamadanSettings } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { ramadanSettingsSerializer } from '../../serializers/kitchen/reachSerializer';

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
          return await fetchRamadan();
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
          const payload = ramadanSettingsSerializer(action.payload);
          state.status = 'succeeded';
          state.data = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Ramadan mode didn't load.");
        },
      },
    ),
    saveRamadanAsync: create.asyncThunk(
      async (input: RamadanInput, { getState, rejectWithValue }) => {
        // A PUT replaces the whole: what changed, over what is saved.
        const d = (getState() as { ramadanMode: RamadanModeSliceState }).ramadanMode.data;
        const win = (w: { from: string; to: string } | undefined) => (w?.from && w.to ? { from: w.from, to: w.to } : undefined);
        try {
          return await updateRamadan({
            enabled: input.enabled ?? d?.enabled ?? false,
            sehri: 'sehri' in input ? input.sehri : win(d?.sehri),
            iftar: 'iftar' in input ? input.iftar : win(d?.iftar),
            iftarPreorderOnly: input.iftarPreorderOnly ?? d?.iftarPreorderOnly ?? false,
          });
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
          const payload = ramadanSettingsSerializer(action.payload);
          state.saving = false;
          state.data = payload;
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
