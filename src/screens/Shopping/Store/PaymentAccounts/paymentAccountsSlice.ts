// MetroMatrix — Payment accounts slice: where customers (or patients) send
// transfers. One screen for stores and doctors: the partner's service picks
// the endpoints.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { createPaymentAccountAPI, deletePaymentAccountAPI, getPaymentAccountsAPI, updatePaymentAccountAPI } from '@networks/shopping/partner/storeNetwork';
import {
  createDoctorPaymentAccountAPI,
  deleteDoctorPaymentAccountAPI,
  getDoctorPaymentAccountsAPI,
  updateDoctorPaymentAccountAPI,
} from '@networks/health/doctor/practiceNetwork';
import {
  createVendorPaymentAccountAPI,
  deleteVendorPaymentAccountAPI,
  getVendorPaymentAccountsAPI,
  updateVendorPaymentAccountAPI,
} from '@networks/food/vendor/settingsNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import { normaliseAccountNumber } from '@models/shopping/storeModel';
import type { PaymentAccount, PaymentAccountInput } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { paymentAccountListSerializer, paymentAccountSerializer } from '@serializers/shopping/partnerSerializer';
import { vendorPaymentAccountSerializer, vendorPaymentAccountsSerializer } from '@serializers/food/vendorSerializer';
import { doctorPaymentAccountListSerializer, doctorPaymentAccountSerializer } from '@serializers/health/doctorSerializer';

export interface PaymentAccountsSliceState {
  accounts: PaymentAccount[];
  status: FormStatus;
  busy: string | null;
  error: ServerError;
  /** The sheet: null closed, '' new, an id to edit. */
  editing: string | null;
  form: PaymentAccountInput;
  submitted: boolean;
}

type PartnerState = { auth: { business: { serviceType: string } | null } };

// Each service's thin calls, serialized here (FinMatrix: Network → Serializer).
const STORE = {
  list: async () => required(paymentAccountListSerializer(await getPaymentAccountsAPI())),
  create: async (input: PaymentAccountInput) => required(paymentAccountSerializer(await createPaymentAccountAPI(input))),
  update: async (id: string, input: PaymentAccountInput) =>
    required(paymentAccountSerializer(await updatePaymentAccountAPI(id, input))),
  remove: async (id: string) => {
    await deletePaymentAccountAPI(id);
    return true as const;
  },
};
const DOCTOR = {
  list: async () => required(doctorPaymentAccountListSerializer(await getDoctorPaymentAccountsAPI())),
  create: async (input: PaymentAccountInput) => required(doctorPaymentAccountSerializer(await createDoctorPaymentAccountAPI(input))),
  update: async (id: string, input: PaymentAccountInput) =>
    required(doctorPaymentAccountSerializer(await updateDoctorPaymentAccountAPI(id, input))),
  remove: async (id: string) => {
    await deleteDoctorPaymentAccountAPI(id);
    return true as const;
  },
};
const FOOD = {
  list: async () => required(vendorPaymentAccountsSerializer(await getVendorPaymentAccountsAPI())),
  create: async (input: PaymentAccountInput) => required(vendorPaymentAccountSerializer(await createVendorPaymentAccountAPI(input))),
  update: async (id: string, input: PaymentAccountInput) =>
    required(vendorPaymentAccountSerializer(await updateVendorPaymentAccountAPI(id, input))),
  remove: async (id: string) => {
    await deleteVendorPaymentAccountAPI(id);
    return true as const;
  },
};
const apiFor = (getState: () => unknown) => {
  const service = (getState() as PartnerState).auth.business?.serviceType;
  return service === 'healthcare' ? DOCTOR : service === 'food' ? FOOD : STORE;
};

const blank = (): PaymentAccountInput => ({ kind: 'raast', title: '', number: '', bankName: null, isActive: true });

const initialState: PaymentAccountsSliceState = { accounts: [], status: 'idle', busy: null, error: NO_ERROR, editing: null, form: blank(), submitted: false };

export const paymentAccountsSlice = createAppSlice({
  name: 'paymentAccounts',
  initialState,
  reducers: create => ({
    openAccountSheet: create.reducer((state, action: PayloadAction<PaymentAccount | null>) => {
      const a = action.payload;
      state.editing = a ? a.id : '';
      state.form = a ? { kind: a.kind, title: a.title, number: a.number, bankName: a.bankName, isActive: a.isActive } : blank();
      state.submitted = false;
      state.error = NO_ERROR;
    }),
    closeAccountSheet: create.reducer(state => {
      state.editing = null;
    }),
    setAccountField: create.reducer(<K extends keyof PaymentAccountInput>(state: PaymentAccountsSliceState, action: PayloadAction<{ field: K; value: PaymentAccountInput[K] }>) => {
      state.form[action.payload.field] = action.payload.value;
    }),
    markAccountSubmitted: create.reducer(state => {
      state.submitted = true;
    }),
    loadAccountsAsync: create.asyncThunk(
      async (_: void, { getState, rejectWithValue }) => {
        try {
          return await apiFor(getState).list();
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
          state.accounts = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't load your accounts.");
        },
      },
    ),
    changeAccountAsync: create.asyncThunk(
      async (
        change: { kind: 'save'; id: string; input: PaymentAccountInput } | { kind: 'delete'; id: string } | { kind: 'toggle'; account: PaymentAccount },
        { getState, rejectWithValue },
      ) => {
        try {
          const api = apiFor(getState);
          if (change.kind === 'save') {
            const input = { ...change.input, number: normaliseAccountNumber(change.input.kind, change.input.number), bankName: change.input.kind === 'bank' ? change.input.bankName : null };
            await (change.id ? api.update(change.id, input) : api.create(input));
          } else if (change.kind === 'delete') await api.remove(change.id);
          else {
            const { id, ...rest } = change.account;
            await api.update(id, { ...rest, isActive: !rest.isActive });
          }
          return await api.list();
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busy = action.meta.arg.kind;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = null;
          state.accounts = action.payload;
          state.editing = null;
        },
        rejected: (state, action) => {
          state.busy = null;
          state.error = readRejection(action, "That didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectPaymentAccounts: state => state,
  },
});

export const { openAccountSheet, closeAccountSheet, setAccountField, markAccountSubmitted, loadAccountsAsync, changeAccountAsync } = paymentAccountsSlice.actions;
export const { selectPaymentAccounts } = paymentAccountsSlice.selectors;
