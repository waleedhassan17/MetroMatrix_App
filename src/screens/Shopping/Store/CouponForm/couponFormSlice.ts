// MetroMatrix — Coupon form slice (new or edit; delete).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { createCouponAPI, deleteCouponAPI, updateCouponAPI } from '@networks/shopping/partner/couponsNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import { emptyCouponForm, normaliseCode, toCouponInput, type CouponForm } from '@models/shopping/couponFormModel';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { couponSerializer } from '@serializers/shopping/partnerSerializer';

export interface CouponFormSliceState {
  id: string | null;
  form: CouponForm;
  submitted: boolean;
  status: FormStatus;
  error: ServerError;
}

const initialState: CouponFormSliceState = { id: null, form: emptyCouponForm(), submitted: false, status: 'idle', error: NO_ERROR };

export const couponFormSlice = createAppSlice({
  name: 'couponForm',
  initialState,
  reducers: create => ({
    startCouponForm: create.reducer((_state, action: PayloadAction<{ id: string | null; form: CouponForm }>) => ({
      ...initialState,
      id: action.payload.id,
      form: action.payload.form,
    })),
    setCouponField: create.reducer(
      <K extends keyof CouponForm>(state: CouponFormSliceState, action: PayloadAction<{ field: K; value: CouponForm[K] }>) => {
        const { field, value } = action.payload;
        state.form[field] = (field === 'code' ? normaliseCode(String(value)) : value) as CouponForm[K];
      },
    ),
    markCouponSubmitted: create.reducer(state => {
      state.submitted = true;
    }),
    saveCouponAsync: create.asyncThunk(
      async ({ id, form }: { id: string | null; form: CouponForm }, { rejectWithValue }) => {
        try {
          return id ? required(couponSerializer(await updateCouponAPI(id, toCouponInput(form)))) : required(couponSerializer(await createCouponAPI(toCouponInput(form))));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.submitted = true;
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.status = 'succeeded';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't save this coupon.");
        },
      },
    ),
    deleteCouponAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return await deleteCouponAPI(id);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
        },
        fulfilled: state => {
          state.status = 'succeeded';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't delete this coupon.");
        },
      },
    ),
  }),
  selectors: {
    selectCouponForm: state => state,
  },
});

export const { startCouponForm, setCouponField, markCouponSubmitted, saveCouponAsync, deleteCouponAsync } = couponFormSlice.actions;
export const { selectCouponForm } = couponFormSlice.selectors;
