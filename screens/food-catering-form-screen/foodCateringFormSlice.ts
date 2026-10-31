// MetroMatrix — Food Court: "Plan a dawat". What the kitchen takes and its
// menu, the request form (checked by models/kitchen/cateringModel), sent.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchCateringVendor, requestCatering } from '../../networks/foodGrowth/catering';
import { toRejectedValue, required } from '../../networks/network/network';
import { emptyCateringForm, newDishKey, type CateringForm } from '../../models/kitchen/cateringModel';
import type { CateringRequestInput, CateringVendor } from '../../models';
import type { ValidationErrors } from '../../models/authModel';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { cateringVendorSerializer, cateringRequestSerializer } from '../../serializers/kitchen/growthSerializer';

export interface FoodCateringFormSliceState {
  slug: string | null;
  vendor: CateringVendor | null;
  form: CateringForm;
  errors: ValidationErrors;
  status: FormStatus;
  error: ServerError;
  sending: boolean;
  sendError: ServerError;
}

const initialState: FoodCateringFormSliceState = { slug: null, vendor: null, form: emptyCateringForm(), errors: {}, status: 'idle', error: NO_ERROR, sending: false, sendError: NO_ERROR };

export const foodCateringFormSlice = createAppSlice({
  name: 'foodCateringForm',
  initialState,
  reducers: create => ({
    editCatering: create.reducer((state, action: PayloadAction<Partial<Omit<CateringForm, 'dishes'>>>) => {
      state.form = { ...state.form, ...action.payload };
      for (const k of Object.keys(action.payload)) delete state.errors[k];
      state.sendError = NO_ERROR;
    }),
    addCateringDish: create.reducer((state, action: PayloadAction<{ itemId: string | null; name: string }>) => {
      state.form.dishes.push({ key: newDishKey(), itemId: action.payload.itemId, name: action.payload.name, qty: state.form.guests.trim() || '' });
      delete state.errors.dishes;
    }),
    editCateringDish: create.reducer((state, action: PayloadAction<{ key: string; patch: { name?: string; qty?: string } }>) => {
      const d = state.form.dishes.find(x => x.key === action.payload.key);
      if (d) Object.assign(d, action.payload.patch);
      delete state.errors.dishes;
    }),
    removeCateringDish: create.reducer((state, action: PayloadAction<string>) => {
      state.form.dishes = state.form.dishes.filter(d => d.key !== action.payload);
    }),
    setCateringErrors: create.reducer((state, action: PayloadAction<ValidationErrors>) => {
      state.errors = action.payload;
    }),
    loadCateringVendorAsync: create.asyncThunk(
      async (slug: string, { rejectWithValue }) => {
        try {
          return required(cateringVendorSerializer(await fetchCateringVendor(slug)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          if (state.slug !== action.meta.arg) {
            state.vendor = null;
            state.form = emptyCateringForm();
            state.errors = {};
            state.sendError = NO_ERROR;
          }
          state.slug = action.meta.arg;
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.vendor = action.payload;
          if (action.payload && !state.form.date) state.form.date = action.payload.earliestDate;
          if (action.payload && !action.payload.modes.includes(state.form.mode)) state.form.mode = action.payload.modes[0] ?? 'delivery';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The kitchen's catering didn't load.");
        },
      },
    ),
    sendCateringAsync: create.asyncThunk(
      async (input: CateringRequestInput, { rejectWithValue }) => {
        try {
          return required(cateringRequestSerializer(await requestCatering(input)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.sending = true;
          state.sendError = NO_ERROR;
        },
        fulfilled: state => {
          state.sending = false;
          state.form = emptyCateringForm();
          state.slug = null;
        },
        rejected: (state, action) => {
          state.sending = false;
          state.sendError = readRejection(action, "Your request didn't send.");
        },
      },
    ),
  }),
  selectors: {
    selectFoodCateringForm: state => state,
  },
});

export const { editCatering, addCateringDish, editCateringDish, removeCateringDish, setCateringErrors, loadCateringVendorAsync, sendCateringAsync } = foodCateringFormSlice.actions;
export const { selectFoodCateringForm } = foodCateringFormSlice.selectors;
