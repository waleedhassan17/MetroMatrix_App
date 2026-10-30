// ═══════════════════════════════════════════════════════
// MetroMatrix — The doctor's profile (what patients read)
// ═══════════════════════════════════════════════════════
// The form is the profile itself; the specialty and condition lists come
// from the catalogue. The photo uploads at once (purpose doctor_photo).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';

import { getConditionsAPI, getSpecialtiesAPI } from '@networks/health/discoveryNetwork';
import { uploadImage } from '@/services/mediaUpload';
import { toRejectedValue, required } from '@networks/network/apiHelpers';
import { ownProfilePatch } from '@models/health/doctorProfileModel';
import type { Condition, DoctorOwnProfile, LocalFile, Specialty } from '@/types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { specialtiesSerializer, conditionsSerializer } from '@serializers/health/discoverySerializer';
import { getOwnProfile, updateOwnProfile } from '@screens/Health/Doctor/shared/practiceReads';

export interface DoctorProfileEditSliceState {
  form: DoctorOwnProfile | null;
  specialties: Specialty[];
  conditions: Condition[];
  conditionQuery: string;
  newService: string;
  picker: 'specialty' | 'secondary' | null;
  uploading: boolean;
  touched: boolean;
  status: FormStatus;
  saveStatus: FormStatus;
  error: ServerError;
}

const initialState: DoctorProfileEditSliceState = {
  form: null,
  specialties: [],
  conditions: [],
  conditionQuery: '',
  newService: '',
  picker: null,
  uploading: false,
  touched: false,
  status: 'idle',
  saveStatus: 'idle',
  error: NO_ERROR,
};

export const doctorProfileEditSlice = createAppSlice({
  name: 'doctorProfileEdit',
  initialState,
  reducers: create => ({
    editProfile: create.reducer((state, action: PayloadAction<Partial<DoctorOwnProfile>>) => {
      if (state.form) state.form = { ...state.form, ...action.payload };
    }),
    setConditionQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.conditionQuery = action.payload;
    }),
    setNewService: create.reducer((state, action: PayloadAction<string>) => {
      state.newService = action.payload;
    }),
    addService: create.reducer(state => {
      const s = state.newService.trim();
      if (!state.form || !s || state.form.services.includes(s)) return;
      state.form.services.push(s);
      state.newService = '';
    }),
    openPicker: create.reducer((state, action: PayloadAction<'specialty' | 'secondary' | null>) => {
      state.picker = action.payload;
    }),
    touchProfile: create.reducer(state => {
      state.touched = true;
    }),

    loadOwnProfileAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          const [profile, specialties, conditions] = await Promise.all([getOwnProfile(), getSpecialtiesAPI(null).then(raw => required(specialtiesSerializer(raw))), getConditionsAPI().then(raw => required(conditionsSerializer(raw)))]);
          return { profile, specialties, conditions };
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
          state.form = action.payload.profile;
          state.specialties = action.payload.specialties;
          state.conditions = action.payload.conditions;
          state.touched = false;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your profile didn't load.");
        },
      },
    ),
    uploadPhotoAsync: create.asyncThunk(
      async (file: LocalFile, { rejectWithValue }) => {
        try {
          const uploaded = await uploadImage(file, 'doctor_photo');
          return await updateOwnProfile({ photoUrl: uploaded.url });
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.uploading = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.uploading = false;
          if (state.form) state.form.photoUrl = action.payload.photoUrl;
        },
        rejected: (state, action) => {
          state.uploading = false;
          state.error = readRejection(action, "The photo didn't upload. Try again.");
        },
      },
    ),
    saveOwnProfileAsync: create.asyncThunk(
      async (form: DoctorOwnProfile, { rejectWithValue }) => {
        try {
          return await updateOwnProfile(ownProfilePatch(form));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saveStatus = 'loading';
          state.touched = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.saveStatus = 'succeeded';
          state.form = action.payload;
        },
        rejected: (state, action) => {
          state.saveStatus = 'failed';
          state.error = readRejection(action, "Your profile wasn't saved. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectProfileEdit: state => state,
  },
});

export const {
  editProfile,
  setConditionQuery,
  setNewService,
  addService,
  openPicker,
  touchProfile,
  loadOwnProfileAsync,
  uploadPhotoAsync,
  saveOwnProfileAsync,
} = doctorProfileEditSlice.actions;
export const { selectProfileEdit } = doctorProfileEditSlice.selectors;
