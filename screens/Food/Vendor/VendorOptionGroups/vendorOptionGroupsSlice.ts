// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: the add-on group library
// ═══════════════════════════════════════════════════════
// Every reusable group (Spice level, Extra toppings…) with its choices, and
// a switch per choice for when it runs out today.

import { createAppSlice } from '../../../../store/createAppSlice';
import { getOptionGroupsAPI } from '../../../../networks/food/vendor/menuNetwork';
import { getAvailabilityAPI, setAvailabilityAPI } from '../../../../networks/food/vendor/availabilityNetwork';
import { toRejectedValue, required } from '../../../../networks/network/apiHelpers';
import type { OptionGroup } from '../../../../types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { optionGroupsSerializer, menuAvailabilitySerializer } from '../../../../serializers/food/menuSerializer';

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
          const [groups, availability] = await Promise.all([getOptionGroupsAPI().then(raw => required(optionGroupsSerializer(raw))), getAvailabilityAPI().then(raw => required(menuAvailabilitySerializer(raw)))]);
          return { groups, available: Object.fromEntries(availability.options.map(o => [o.optionId, o.isAvailable])) };
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
          state.groups = action.payload.groups;
          state.available = action.payload.available;
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
          const a = required(menuAvailabilitySerializer(await setAvailabilityAPI({ options: [{ optionId, isAvailable }] })));
          return Object.fromEntries(a.options.map(o => [o.optionId, o.isAvailable]));
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
          state.available = action.payload;
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
