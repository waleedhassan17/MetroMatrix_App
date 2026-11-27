// ═══════════════════════════════════════════════════════
// MetroMatrix — what the doctor's server can do, and the pause switch
// ═══════════════════════════════════════════════════════
// GET /health/doctor/profile `features`: a control (walk-ins, day hours,
// moving a visit…) shows only when the server it talks to can do it, so the
// app is right before and after a backend redeploy. `isAccepting` is the
// doctor's "Taking new bookings" switch (PATCH /profile), which Today and
// Availability both show. Loaded by the doctor's navigator; account-scoped,
// so a sign-out wipes it.

import { createAppSlice } from './createAppSlice';
import { fetchOwnProfile, updateOwnProfile } from '../networks/health/doctor/profile';
import { toRejectedValue } from '../networks/network/network';
import { doctorFeaturesSerializer } from '../serializers/health/doctorSerializer';
import type { DoctorFeature } from '../models/health';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../screens/shared/formStatus';

export interface DoctorFeaturesSliceState {
  features: DoctorFeature[];
  /** null until read. */
  isAccepting: boolean | null;
  status: FormStatus;
  switching: boolean;
  error: ServerError;
}

const initialState: DoctorFeaturesSliceState = { features: [], isAccepting: null, status: 'idle', switching: false, error: NO_ERROR };

export const doctorFeaturesSlice = createAppSlice({
  name: 'doctorFeatures',
  initialState,
  reducers: create => ({
    loadDoctorFeaturesAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return await fetchOwnProfile();
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
          const read = doctorFeaturesSerializer(action.payload);
          if (!read) return;
          state.features = read.features;
          state.isAccepting = read.isAccepting;
        },
        // Best effort: without the list, the app shows only what every server can do.
        rejected: state => {
          state.status = 'failed';
        },
      },
    ),
    /** "Taking new bookings": off pauses them (patients see no times; booked visits stay). */
    setAcceptingAsync: create.asyncThunk(
      async (accepting: boolean, { rejectWithValue }) => {
        try {
          return await updateOwnProfile({ isAccepting: accepting });
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.switching = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.switching = false;
          const read = doctorFeaturesSerializer(action.payload);
          state.isAccepting = read ? read.isAccepting : action.meta.arg;
        },
        rejected: (state, action) => {
          state.switching = false;
          state.error = readRejection(action, "That didn't change. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectDoctorFeatures: state => state,
    selectHasDoctorFeature: (state, feature: DoctorFeature) => state.features.includes(feature),
  },
});

export const { loadDoctorFeaturesAsync, setAcceptingAsync } = doctorFeaturesSlice.actions;
export const { selectDoctorFeatures, selectHasDoctorFeature } = doctorFeaturesSlice.selectors;
