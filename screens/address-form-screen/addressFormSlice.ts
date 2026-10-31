// ═══════════════════════════════════════════════════════
// MetroMatrix — Address form slice (add or edit a delivery address)
// ═══════════════════════════════════════════════════════

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { createAddress, fetchAddresses, updateAddress } from '../../networks/addresses/addresses';
import { toRejectedValue, required } from '../../networks/network/network';
import { emptyAddressForm, toAddressInput, type AddressForm } from '../../models/addressModel';
import { locateBusiness } from '../../services/location';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { addressSerializer, addressListSerializer } from '../../serializers/addressSerializer';

export interface AddressFormSliceState {
  /** The address being edited, or null for a new one. */
  editingId: string | null;
  form: AddressForm;
  touched: Partial<Record<keyof AddressForm, boolean>>;
  submitted: boolean;
  status: FormStatus;
  error: ServerError;
  locating: boolean;
}

const initialState: AddressFormSliceState = {
  editingId: null,
  form: emptyAddressForm(),
  touched: {},
  submitted: false,
  status: 'idle',
  error: NO_ERROR,
  locating: false,
};

export const addressFormSlice = createAppSlice({
  name: 'addressForm',
  initialState,
  reducers: create => ({
    startAddressForm: create.reducer((state, action: PayloadAction<{ id: string | null; form: AddressForm }>) => {
      return { ...initialState, editingId: action.payload.id, form: action.payload.form };
    }),
    setAddressField: create.reducer(
      <K extends keyof AddressForm>(state: AddressFormSliceState, action: PayloadAction<{ field: K; value: AddressForm[K] }>) => {
        state.form[action.payload.field] = action.payload.value;
      },
    ),
    touchAddressField: create.reducer((state, action: PayloadAction<keyof AddressForm>) => {
      state.touched[action.payload] = true;
    }),

    locateAddressAsync: create.asyncThunk(
      async () => locateBusiness(),
      {
        pending: state => {
          state.locating = true;
        },
        fulfilled: (state, action) => {
          state.locating = false;
          const place = action.payload;
          if (!place) return;
          state.form.lat = place.location.lat;
          state.form.lng = place.location.lng;
          if (place.city && !state.form.city) state.form.city = place.city;
          if (place.address && !state.form.line1) state.form.line1 = place.address;
        },
        rejected: state => {
          state.locating = false;
        },
      },
    ),

    saveAddressAsync: create.asyncThunk(
      async ({ id, form }: { id: string | null; form: AddressForm }, { rejectWithValue }) => {
        try {
          const saved = id ? required(addressSerializer(await updateAddress(id, toAddressInput(form)))) : required(addressSerializer(await createAddress(toAddressInput(form))));
          return { saved, all: required(addressListSerializer(await fetchAddresses())) };
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
          state.error = readRejection(action, "We couldn't save this address.");
        },
      },
    ),
  }),
  selectors: {
    selectAddressForm: state => state,
  },
});

export const { startAddressForm, setAddressField, touchAddressField, locateAddressAsync, saveAddressAsync } = addressFormSlice.actions;
export const { selectAddressForm } = addressFormSlice.selectors;
