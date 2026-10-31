// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: one add-on group (new or edit)
// ═══════════════════════════════════════════════════════
// Its name, how many customers must / may pick, and its choices (each with an
// extra price, optionally ticked to start). Editing changes it on every dish
// that offers it.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../../store/createAppSlice';
import { createOptionGroupAPI, deleteOptionGroupAPI, getOptionGroupAPI, updateOptionGroupAPI } from '../../../../networks/food/vendor/menuNetwork';
import { toRejectedValue, required } from '../../../../networks/network/apiHelpers';
import { emptyGroupForm, groupForm, groupInput, type GroupForm } from '../../../../models/food/menuModel';
import type { OptionGroup } from '../../../../types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { menuChanged } from '../VendorMenu/vendorMenuSlice';
import { optionGroupSerializer } from '../../../../serializers/food/menuSerializer';

export interface VendorOptionGroupSliceState {
  group: OptionGroup | null;
  form: GroupForm | null;
  status: FormStatus;
  saving: boolean;
  submitted: boolean;
  error: ServerError;
}

const initialState: VendorOptionGroupSliceState = { group: null, form: null, status: 'idle', saving: false, submitted: false, error: NO_ERROR };

export const vendorOptionGroupSlice = createAppSlice({
  name: 'vendorOptionGroup',
  initialState,
  reducers: create => ({
    setGroupName: create.reducer((state, action: PayloadAction<string>) => {
      if (state.form) state.form.name = action.payload;
    }),
    /** Required means at least one choice; optional means none needed. */
    setGroupRequired: create.reducer((state, action: PayloadAction<boolean>) => {
      if (!state.form) return;
      state.form.minSelect = action.payload ? Math.max(1, Math.min(state.form.minSelect || 1, state.form.maxSelect)) : 0;
    }),
    setGroupMin: create.reducer((state, action: PayloadAction<number>) => {
      if (!state.form) return;
      state.form.minSelect = action.payload;
      if (state.form.maxSelect < action.payload) state.form.maxSelect = action.payload;
    }),
    setGroupMax: create.reducer((state, action: PayloadAction<number>) => {
      if (!state.form) return;
      state.form.maxSelect = action.payload;
      if (state.form.minSelect > action.payload) state.form.minSelect = action.payload;
    }),
    addGroupOption: create.reducer(state => {
      state.form?.options.push({ name: '', priceDelta: '0', isDefault: false, isActive: true });
    }),
    setGroupOption: create.reducer((state, action: PayloadAction<{ index: number; field: 'name' | 'priceDelta'; value: string }>) => {
      const o = state.form?.options[action.payload.index];
      if (o) o[action.payload.field] = action.payload.value;
    }),
    toggleGroupOptionDefault: create.reducer((state, action: PayloadAction<number>) => {
      const o = state.form?.options[action.payload];
      if (o) o.isDefault = !o.isDefault;
    }),
    removeGroupOption: create.reducer((state, action: PayloadAction<number>) => {
      if (!state.form) return;
      state.form.options.splice(action.payload, 1);
      state.form.maxSelect = Math.max(1, Math.min(state.form.maxSelect, state.form.options.length));
      state.form.minSelect = Math.min(state.form.minSelect, state.form.maxSelect);
    }),
    markGroupSubmitted: create.reducer(state => {
      state.submitted = true;
    }),
    loadOptionGroupAsync: create.asyncThunk(
      async (id: string | undefined, { rejectWithValue }) => {
        try {
          return id ? required(optionGroupSerializer(await getOptionGroupAPI(id))) : null;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          Object.assign(state, initialState, { status: 'loading' });
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.group = action.payload;
          state.form = action.payload ? groupForm(action.payload) : emptyGroupForm();
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The group didn't load.");
        },
      },
    ),
    saveOptionGroupAsync: create.asyncThunk(
      async (_: void, { getState, dispatch, rejectWithValue }) => {
        const { group, form } = (getState() as { vendorOptionGroup: VendorOptionGroupSliceState }).vendorOptionGroup;
        if (!form) return rejectWithValue({ message: 'Nothing to save.', code: null, details: null });
        try {
          const saved = group ? required(optionGroupSerializer(await updateOptionGroupAPI(group.id, groupInput(form)))) : required(optionGroupSerializer(await createOptionGroupAPI(groupInput(form))));
          dispatch(menuChanged());
          return saved;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.saving = false;
          state.group = action.payload;
          state.form = groupForm(action.payload);
          state.submitted = false;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "The group didn't save.");
        },
      },
    ),
    deleteOptionGroupAsync: create.asyncThunk(
      async (id: string, { dispatch, rejectWithValue }) => {
        try {
          await deleteOptionGroupAPI(id);
          dispatch(menuChanged());
          return id;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.saving = false;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "The group wasn't deleted.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorOptionGroup: state => state,
  },
});

export const {
  setGroupName,
  setGroupRequired,
  setGroupMin,
  setGroupMax,
  addGroupOption,
  setGroupOption,
  toggleGroupOptionDefault,
  removeGroupOption,
  markGroupSubmitted,
  loadOptionGroupAsync,
  saveOptionGroupAsync,
  deleteOptionGroupAsync,
} = vendorOptionGroupSlice.actions;
export const { selectVendorOptionGroup } = vendorOptionGroupSlice.selectors;
