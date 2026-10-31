// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: the add-on group library
// ═══════════════════════════════════════════════════════
// Every reusable group (Spice level, Extra toppings…) with its choices, and
// a switch per choice for when it runs out today.

import { createAppSlice } from '../../store/createAppSlice';
import { fetchOptionGroups } from '../../networks/food/vendor/menu';
import { fetchAvailability, setAvailability } from '../../networks/food/vendor/availability';
import { toRejectedValue } from '../../networks/network/network';
import type { OptionGroup } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { optionGroupsSerializer, menuAvailabilitySerializer } from '../../serializers/food/menuSerializer';

export interface VendorOptionGroupsSliceState {
  groups: OptionGroup[];
  /** In stock now, by option id. */
  available: Record<string, boolean>;
  status: FormStatus;
  error: ServerError;
  saving: string[];
}

const initialState: VendorOptionGroupsSliceState = { groups: [], available: {}, status: 'idle', error: NO_ERROR, saving: [] };

export const vendorOptionGroupsSlice = createAppSlice({
  name: 'vendorOptionGroups',
  initialState,
  reducers: create => ({
    loadOptionGroupsAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          const [groups, availability] = await Promise.all([fetchOptionGroups(), fetchAvailability()]);
          return { groups, availability };
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
          state.groups = optionGroupsSerializer(action.payload.groups);
          state.available = Object.fromEntries(menuAvailabilitySerializer(action.payload.availability).options.map(o => [o.optionId, o.isAvailable]));
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your add-ons didn't load.");
        },
      },
    ),
    setOptionAvailableAsync: create.asyncThunk(
      async ({ optionId, isAvailable }: { optionId: string; isAvailable: boolean }, { rejectWithValue }) => {
        try {
          return await setAvailability({ options: [{ optionId, isAvailable }] });
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.saving.push(action.meta.arg.optionId);
          state.available[action.meta.arg.optionId] = action.meta.arg.isAvailable;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.saving = state.saving.filter(id => id !== action.meta.arg.optionId);
          state.available = Object.fromEntries(menuAvailabilitySerializer(action.payload).options.map(o => [o.optionId, o.isAvailable]));
        },
        rejected: (state, action) => {
          state.saving = state.saving.filter(id => id !== action.meta.arg.optionId);
          state.available[action.meta.arg.optionId] = !action.meta.arg.isAvailable;
          state.error = readRejection(action, "That didn't change. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorOptionGroups: state => state,
  },
});

export const { loadOptionGroupsAsync, setOptionAvailableAsync } = vendorOptionGroupsSlice.actions;
export const { selectVendorOptionGroups } = vendorOptionGroupsSlice.selectors;
