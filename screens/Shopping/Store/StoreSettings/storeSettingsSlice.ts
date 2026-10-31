// MetroMatrix — Store settings slice: delivery, dispatch, returns, cash on delivery, pause.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../../store/createAppSlice';
import { getStoreSettingsAPI, getPaymentAccountsAPI, updateStoreSettingsAPI } from '../../../../networks/shopping/partner/storeNetwork';
import { toRejectedValue, required } from '../../../../networks/network/apiHelpers';
import type { StoreSettings } from '../../../../types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { storeSettingsSerializer, paymentAccountListSerializer } from '../../../../serializers/shopping/partnerSerializer';

export interface StoreSettingsSliceState {
  form: StoreSettings | null;
  hasActiveAccount: boolean;
  status: FormStatus;
  saveStatus: FormStatus;
  submitted: boolean;
  error: ServerError;
}

const initialState: StoreSettingsSliceState = { form: null, hasActiveAccount: false, status: 'idle', saveStatus: 'idle', submitted: false, error: NO_ERROR };

export const storeSettingsSlice = createAppSlice({
  name: 'storeSettings',
  initialState,
  reducers: create => ({
    setSetting: create.reducer(<K extends keyof StoreSettings>(state: StoreSettingsSliceState, action: PayloadAction<{ field: K; value: StoreSettings[K] }>) => {
      if (state.form) state.form[action.payload.field] = action.payload.value;
    }),
    toggleCity: create.reducer((state, action: PayloadAction<string>) => {
      if (!state.form) return;
      const c = action.payload;
      state.form.deliveryCities = state.form.deliveryCities.includes(c) ? state.form.deliveryCities.filter(x => x !== c) : [...state.form.deliveryCities, c];
    }),
    markSettingsSubmitted: create.reducer(state => {
      state.submitted = true;
    }),
    loadStoreSettingsAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          const [settings, accounts] = await Promise.all([getStoreSettingsAPI().then(raw => required(storeSettingsSerializer(raw))), getPaymentAccountsAPI().then(raw => required(paymentAccountListSerializer(raw)))]);
          return { settings, hasActiveAccount: accounts.some(a => a.isActive) };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.form = action.payload.settings;
          state.hasActiveAccount = action.payload.hasActiveAccount;
          state.submitted = false;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't load your settings.");
        },
      },
    ),
    saveStoreSettingsAsync: create.asyncThunk(
      async (input: StoreSettings, { rejectWithValue }) => {
        try {
          return required(storeSettingsSerializer(await updateStoreSettingsAPI(input)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saveStatus = 'loading';
          state.submitted = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.saveStatus = 'succeeded';
          state.form = action.payload;
        },
        rejected: (state, action) => {
          state.saveStatus = 'failed';
          state.error = readRejection(action, "We couldn't save your settings.");
        },
      },
    ),
  }),
  selectors: {
    selectStoreSettings: state => state,
  },
});

export const { setSetting, toggleCity, markSettingsSubmitted, loadStoreSettingsAsync, saveStoreSettingsAsync } = storeSettingsSlice.actions;
export const { selectStoreSettings } = storeSettingsSlice.selectors;
