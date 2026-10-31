// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: one deal (new or edit)
// ═══════════════════════════════════════════════════════
// What it gives (a share off, rupees off, free delivery), on which dishes,
// above what order, with or without a code, on which days and hours, until
// when and how many times. The checks are the API's (promotionModel); the
// label customers will see updates as it is typed.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { createPromotion, deactivatePromotion, deletePromotion, fetchPromotion, updatePromotion } from '../../networks/food/vendor/promotions';
import { fetchMenuItems } from '../../networks/food/vendor/menu';
import { toRejectedValue, required } from '../../networks/network/network';
import { emptyPromotionForm, promotionForm, promotionInput, type PromotionForm } from '../../models/food/promotionModel';
import type { FoodPromotion, PromotionKind, VendorMenuItem } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { foodPromotionSerializer } from '../../serializers/food/orderSerializer';
import { vendorMenuItemsSerializer } from '../../serializers/food/menuSerializer';

type TextField = 'title' | 'value' | 'minOrder' | 'maxDiscount' | 'code' | 'timeFrom' | 'timeTo' | 'endsOn' | 'usageLimit' | 'perUserLimit';

export interface VendorPromotionSliceState {
  promotion: FoodPromotion | null;
  form: PromotionForm | null;
  /** The kitchen's dishes, for "% off some dishes". */
  dishes: Pick<VendorMenuItem, 'id' | 'name'>[];
  status: FormStatus;
  saving: boolean;
  submitted: boolean;
  error: ServerError;
}

const initialState: VendorPromotionSliceState = { promotion: null, form: null, dishes: [], status: 'idle', saving: false, submitted: false, error: NO_ERROR };

export const vendorPromotionSlice = createAppSlice({
  name: 'vendorPromotion',
  initialState,
  reducers: create => ({
    setPromotionText: create.reducer((state, action: PayloadAction<{ field: TextField; value: string }>) => {
      if (state.form) state.form[action.payload.field] = action.payload.value;
    }),
    setPromotionKind: create.reducer((state, action: PayloadAction<PromotionKind>) => {
      if (!state.form) return;
      const wasFlat = state.form.kind === 'flat_off';
      state.form.kind = action.payload;
      // A sensible number for the new kind.
      if (action.payload === 'flat_off' && !wasFlat) state.form.value = '100';
      else if (action.payload !== 'flat_off' && wasFlat) state.form.value = '10';
    }),
    setPromotionFlag: create.reducer((state, action: PayloadAction<{ field: 'withCode' | 'withWindow' | 'firstOrderOnly'; value: boolean }>) => {
      if (state.form) state.form[action.payload.field] = action.payload.value;
    }),
    togglePromotionDay: create.reducer((state, action: PayloadAction<number>) => {
      if (!state.form) return;
      const d = action.payload;
      state.form.weekdays = state.form.weekdays.includes(d) ? state.form.weekdays.filter(x => x !== d) : [...state.form.weekdays, d].sort();
    }),
    togglePromotionDish: create.reducer((state, action: PayloadAction<string>) => {
      if (!state.form) return;
      const id = action.payload;
      state.form.itemIds = state.form.itemIds.includes(id) ? state.form.itemIds.filter(x => x !== id) : [...state.form.itemIds, id];
    }),
    markPromotionSubmitted: create.reducer(state => {
      state.submitted = true;
    }),

    loadPromotionAsync: create.asyncThunk(
      async (id: string | undefined, { rejectWithValue }) => {
        try {
          const [promotion, items] = await Promise.all([id ? fetchPromotion(id).then(raw => required(foodPromotionSerializer(raw))) : Promise.resolve(null), fetchMenuItems().then(raw => required(vendorMenuItemsSerializer(raw)))]);
          return { promotion, dishes: items.map(i => ({ id: i.id, name: i.name })) };
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
          state.promotion = action.payload.promotion;
          state.dishes = action.payload.dishes;
          state.form = action.payload.promotion ? promotionForm(action.payload.promotion) : emptyPromotionForm();
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The deal didn't load.");
        },
      },
    ),

    savePromotionAsync: create.asyncThunk(
      async (_: void, { getState, rejectWithValue }) => {
        const { promotion, form } = (getState() as { vendorPromotion: VendorPromotionSliceState }).vendorPromotion;
        if (!form) return rejectWithValue({ message: 'Nothing to save.', code: null, details: null });
        try {
          return promotion ? required(foodPromotionSerializer(await updatePromotion(promotion.id, promotionInput(form)))) : required(foodPromotionSerializer(await createPromotion(promotionInput(form))));
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
          state.promotion = action.payload;
          state.form = promotionForm(action.payload);
          state.submitted = false;
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "The deal didn't save.");
        },
      },
    ),

    /** Switch it off (a used deal can't be deleted: orders keep what it gave). */
    deactivatePromotionAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return required(foodPromotionSerializer(await deactivatePromotion(id)));
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
          state.promotion = action.payload;
          state.form = promotionForm(action.payload);
        },
        rejected: (state, action) => {
          state.saving = false;
          state.error = readRejection(action, "The deal wasn't switched off.");
        },
      },
    ),

    deletePromotionAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          await deletePromotion(id);
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
          state.error = readRejection(action, "The deal wasn't deleted.");
        },
      },
    ),
  }),
  selectors: {
    selectVendorPromotion: state => state,
  },
});

export const {
  setPromotionText,
  setPromotionKind,
  setPromotionFlag,
  togglePromotionDay,
  togglePromotionDish,
  markPromotionSubmitted,
  loadPromotionAsync,
  savePromotionAsync,
  deactivatePromotionAsync,
  deletePromotionAsync,
} = vendorPromotionSlice.actions;
export const { selectVendorPromotion } = vendorPromotionSlice.selectors;
