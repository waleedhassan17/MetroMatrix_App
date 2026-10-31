// MetroMatrix — Kitchen growth: a tiffin plan (new, or edited). The menu
// to pick each day's dishes from; the form checked by models/kitchen/tiffinModel.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchMenuItems } from '../../networks/food/vendor/menu';
import { createTiffinPlan, deleteTiffinPlan, fetchMyTiffinPlan, updateTiffinPlan } from '../../networks/foodGrowth/tiffin';
import { toRejectedValue } from '../../networks/network/network';
import { MEAL_WINDOWS, emptyPlanForm, formFromPlan, type TiffinPlanForm } from '../../models/kitchen/tiffinModel';
import type { Meal, TiffinPlan, TiffinPlanInput, VendorMenuItem } from '../../models';
import type { ValidationErrors } from '../../models/authModel';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { vendorMenuItemsSerializer } from '../../serializers/food/menuSerializer';
import { tiffinPlanSerializer, tiffinRemovedSerializer } from '../../serializers/kitchen/growthSerializer';

export interface TiffinPlanFormSliceState {
  planId: string | null;
  plan: TiffinPlan | null;
  menu: Pick<VendorMenuItem, 'id' | 'name' | 'basePrice'>[];
  form: TiffinPlanForm;
  errors: ValidationErrors;
  status: FormStatus;
  error: ServerError;
  saving: boolean;
  saveError: ServerError;
  /** What removing the plan did (removed, or only taken off the page). */
  removed: ReturnType<typeof tiffinRemovedSerializer> | null;
}

const initialState: TiffinPlanFormSliceState = {
  planId: null,
  plan: null,
  menu: [],
  form: emptyPlanForm(),
  errors: {},
  status: 'idle',
  error: NO_ERROR,
  saving: false,
  saveError: NO_ERROR,
  removed: null,
};

export const tiffinPlanFormSlice = createAppSlice({
  name: 'tiffinPlanForm',
  initialState,
  reducers: create => ({
    editPlanForm: create.reducer((state, action: PayloadAction<Partial<TiffinPlanForm>>) => {
      state.form = { ...state.form, ...action.payload };
      for (const k of Object.keys(action.payload)) delete state.errors[k === 'from' || k === 'to' ? 'window' : k];
      state.saveError = NO_ERROR;
    }),
    /** A new meal moves the window to that meal's usual hours (while it is still the last meal's). */
    setPlanMeal: create.reducer((state, action: PayloadAction<Meal>) => {
      const was = MEAL_WINDOWS[state.form.meal];
      const usual = state.form.from === was.from && state.form.to === was.to;
      state.form.meal = action.payload;
      if (usual) Object.assign(state.form, MEAL_WINDOWS[action.payload]);
    }),
    togglePlanDay: create.reducer((state, action: PayloadAction<number>) => {
      const d = action.payload;
      state.form.days = state.form.days.includes(d) ? state.form.days.filter(x => x !== d) : [...state.form.days, d].sort((a, b) => a - b);
      delete state.errors.days;
      delete state.errors.rotation;
    }),
    setRotationDay: create.reducer((state, action: PayloadAction<{ weekday: number; itemIds?: string[]; note?: string }>) => {
      const { weekday, ...patch } = action.payload;
      const was = state.form.rotation[weekday] ?? { itemIds: [], note: '' };
      state.form.rotation[weekday] = { itemIds: patch.itemIds ?? was.itemIds, note: patch.note ?? was.note };
      delete state.errors.rotation;
    }),
    setPlanErrors: create.reducer((state, action: PayloadAction<ValidationErrors>) => {
      state.errors = action.payload;
    }),

    loadPlanFormAsync: create.asyncThunk(
      async (id: string | null, { rejectWithValue }) => {
        try {
          const [menu, plan] = await Promise.all([fetchMenuItems(), id ? fetchMyTiffinPlan(id) : Promise.resolve(null)]);
          return { menu, plan };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.planId = action.meta.arg;
          state.plan = null;
          state.form = emptyPlanForm();
          state.errors = {};
          state.saveError = NO_ERROR;
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const plan = action.payload.plan === null ? null : tiffinPlanSerializer(action.payload.plan);
          state.status = 'succeeded';
          state.menu = vendorMenuItemsSerializer(action.payload.menu)
            .filter(i => i.isActive)
            .map(i => ({ id: i.id, name: i.name, basePrice: i.basePrice }));
          state.plan = plan;
          if (plan) state.form = formFromPlan(plan);
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The plan didn't load.");
        },
      },
    ),

    savePlanAsync: create.asyncThunk(
      async ({ id, input }: { id: string | null; input: TiffinPlanInput }, { rejectWithValue }) => {
        try {
          return id ? await updateTiffinPlan(id, input) : await createTiffinPlan(input);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saving = true;
          state.saveError = NO_ERROR;
        },
        fulfilled: state => {
          state.saving = false;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.saveError = readRejection(action, "The plan didn't save.");
        },
      },
    ),

    removePlanAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return await deleteTiffinPlan(id);
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
          const payload = tiffinRemovedSerializer(action.payload);
          state.saving = false;
          state.removed = payload;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.saveError = readRejection(action, "The plan didn't change.");
        },
      },
    ),
  }),
  selectors: {
    selectTiffinPlanForm: state => state,
  },
});

export const { editPlanForm, setPlanMeal, togglePlanDay, setRotationDay, setPlanErrors, loadPlanFormAsync, savePlanAsync, removePlanAsync } = tiffinPlanFormSlice.actions;
export const { selectTiffinPlanForm } = tiffinPlanFormSlice.selectors;
