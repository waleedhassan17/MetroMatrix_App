// ═══════════════════════════════════════════════════════
// MetroMatrix — Business profile slice (draft create / PATCH)
// ═══════════════════════════════════════════════════════
// Fields come from businessModel's schema for the chosen sub-type. Saving
// creates the draft the first time and PATCHes it after, so a partner who
// leaves mid-setup resumes with everything they typed (QA 15).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { createBusiness, updateMyBusiness } from '@networks/businesses/businessNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import {
  businessProfileToPayload,
  businessToProfileForm,
  emptyBusinessProfile,
  type BusinessProfileForm,
  type DetailKey,
} from '@models/businessModel';
import { locateBusiness } from '@/services/location';
import type { Business, ServiceType, SubType } from '@/types';
import { setBusiness } from '../../Auth/authSlice';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../Auth/shared/formStatus';

type CoreField = 'name' | 'city' | 'address';
export type ProfileField = CoreField | DetailKey;

export interface BusinessProfileSliceState {
  /** Which business (or 'new' + sub-type) the form was initialised for. */
  loadedFor: string | null;
  serviceType: ServiceType | null;
  subType: SubType | null;
  form: BusinessProfileForm;
  touched: Partial<Record<ProfileField, boolean>>;
  submitted: boolean;
  picker: 'city' | DetailKey | null;
  status: FormStatus;
  locateStatus: FormStatus;
  error: ServerError;
}

const initialState: BusinessProfileSliceState = {
  loadedFor: null,
  serviceType: null,
  subType: null,
  form: emptyBusinessProfile(),
  touched: {},
  submitted: false,
  picker: null,
  status: 'idle',
  locateStatus: 'idle',
  error: NO_ERROR,
};

export const businessProfileSlice = createAppSlice({
  name: 'businessProfile',
  initialState,
  reducers: create => ({
    /** From the saved draft (resume / edit after rejection) or a fresh choice. */
    initialise: create.reducer(
      (
        state,
        action: PayloadAction<{ business: Business | null; serviceType: ServiceType; subType: SubType }>,
      ) => {
        const { business, serviceType, subType } = action.payload;
        const key = business ? `${business.id}:${subType}` : `new:${subType}`;
        if (state.loadedFor === key) return;
        state.loadedFor = key;
        state.serviceType = serviceType;
        state.subType = subType;
        state.form = business ? businessToProfileForm(business) : emptyBusinessProfile();
        state.touched = {};
        state.submitted = false;
        state.error = NO_ERROR;
      },
    ),
    setCoreField: create.reducer((state, action: PayloadAction<{ field: CoreField; value: string }>) => {
      state.form[action.payload.field] = action.payload.value;
      state.error = NO_ERROR;
    }),
    setDetail: create.reducer((state, action: PayloadAction<{ key: DetailKey; value: string }>) => {
      state.form.details[action.payload.key] = action.payload.value;
    }),
    touch: create.reducer((state, action: PayloadAction<ProfileField>) => {
      state.touched[action.payload] = true;
    }),
    markSubmitted: create.reducer(state => {
      state.submitted = true;
    }),
    openPicker: create.reducer((state, action: PayloadAction<'city' | DetailKey | null>) => {
      state.picker = action.payload;
    }),
    clearLocation: create.reducer(state => {
      state.form.location = null;
    }),

    locateAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          const place = await locateBusiness();
          if (!place) {
            return rejectWithValue({ message: 'Location permission is off. You can type the address instead.' });
          }
          return place;
        } catch {
          return rejectWithValue({ message: "We couldn't find your location. Type the address instead." });
        }
      },
      {
        pending: state => {
          state.locateStatus = 'loading';
        },
        fulfilled: (state, action) => {
          state.locateStatus = 'succeeded';
          state.form.location = action.payload.location;
          if (!state.form.address.trim() && action.payload.address) state.form.address = action.payload.address;
          if (!state.form.city && action.payload.city) state.form.city = action.payload.city;
        },
        rejected: (state, action) => {
          state.locateStatus = 'failed';
          state.error = readRejection(action, "We couldn't find your location.");
        },
      },
    ),

    saveDraftAsync: create.asyncThunk(
      async (
        args: {
          business: Business | null;
          serviceType: ServiceType;
          subType: SubType;
          form: BusinessProfileForm;
          phone: string;
        },
        { dispatch, rejectWithValue },
      ) => {
        try {
          const payload = businessProfileToPayload(args.serviceType, args.subType, args.form, args.phone);
          const saved = args.business ? await updateMyBusiness(payload) : await createBusiness(payload);
          dispatch(setBusiness(saved));
          return saved.id;
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
          state.loadedFor = `${action.payload}:${state.subType}`;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't save your details. Try again.");
        },
      },
    ),
  }),

  selectors: {
    selectBusinessProfile: state => state,
  },
});

export const {
  initialise,
  setCoreField,
  setDetail,
  touch,
  markSubmitted,
  openPicker,
  clearLocation,
  locateAsync,
  saveDraftAsync,
} = businessProfileSlice.actions;

export const { selectBusinessProfile } = businessProfileSlice.selectors;
