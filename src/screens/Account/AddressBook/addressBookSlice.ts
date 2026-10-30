// ═══════════════════════════════════════════════════════
// MetroMatrix — Address book slice (the customer's delivery addresses)
// ═══════════════════════════════════════════════════════
// Read by the address book, the address form (after a save) and Checkout.

import { createAppSlice } from '@store/createAppSlice';
import { deleteAddressAPI, getAddressesAPI, setDefaultAddressAPI } from '@networks/addresses/addressesNetwork';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import type { Address } from '@/types';
import { saveAddressAsync } from '../AddressForm/addressFormSlice';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../Auth/shared/formStatus';
import { addressListSerializer } from '@serializers/addressSerializer';

export interface AddressBookSliceState {
  addresses: Address[];
  status: FormStatus;
  error: ServerError;
  busyId: string | null;
  actionError: ServerError;
}

const initialState: AddressBookSliceState = { addresses: [], status: 'idle', error: NO_ERROR, busyId: null, actionError: NO_ERROR };

export const addressBookSlice = createAppSlice({
  name: 'addressBook',
  initialState,
  reducers: create => ({
    loadAddressesAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(addressListSerializer(await getAddressesAPI()));
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
          state.addresses = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't load your addresses.");
        },
      },
    ),
    setDefaultAddressAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          await setDefaultAddressAPI(id);
          return required(addressListSerializer(await getAddressesAPI()));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busyId = action.meta.arg;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busyId = null;
          state.addresses = action.payload;
        },
        rejected: (state, action) => {
          state.busyId = null;
          state.actionError = readRejection(action, "We couldn't change your default address.");
        },
      },
    ),
    deleteAddressAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          await deleteAddressAPI(id);
          return required(addressListSerializer(await getAddressesAPI()));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busyId = action.meta.arg;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busyId = null;
          state.addresses = action.payload;
        },
        rejected: (state, action) => {
          state.busyId = null;
          state.actionError = readRejection(action, "We couldn't delete that address.");
        },
      },
    ),
  }),
  extraReducers: builder => {
    builder.addCase(saveAddressAsync.fulfilled, (state, action) => {
      state.addresses = action.payload.all;
      state.status = 'succeeded';
    });
  },
  selectors: {
    selectAddressBook: state => state,
  },
});

export const { loadAddressesAsync, setDefaultAddressAsync, deleteAddressAsync } = addressBookSlice.actions;
export const { selectAddressBook } = addressBookSlice.selectors;
