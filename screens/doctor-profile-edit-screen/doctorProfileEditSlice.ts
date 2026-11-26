// ═══════════════════════════════════════════════════════
// MetroMatrix — The doctor's profile (what patients read)
// ═══════════════════════════════════════════════════════
// The form is the profile itself; the specialty and condition lists come
// from the catalogue. The photo uploads at once (purpose doctor_photo). The
// server's word on a field (VALIDATION_FAILED `details.fields`) lands under
// that field, in the form's own names, never as raw text at the top.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';

import { fetchConditions, fetchSpecialties } from '../../networks/health/discovery';
import { uploadImage } from '../../services/mediaUpload';
import { errorCopy, fieldErrors, toRejectedValue } from '../../networks/network/network';
import { ownProfilePatch } from '../../models/health/doctorProfileModel';
import type { Condition, DoctorOwnProfile, LocalFile, Specialty } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { specialtiesSerializer, conditionsSerializer } from '../../serializers/health/discoverySerializer';
import { getOwnProfile, updateOwnProfile } from '../shared/practiceReads';

export interface DoctorProfileEditSliceState {
  form: DoctorOwnProfile | null;
  /** The profile as last loaded or saved: the form differs → unsaved changes. */
  saved: DoctorOwnProfile | null;
  /** The server's word on a field, by the form's own key ("qualification.0.institute"). */
  serverErrors: Record<string, string>;
  /** Picking another specialty (it joins the list of extra ones). */
  specialties: Specialty[];
  conditions: Condition[];
  conditionQuery: string;
  newService: string;
  picker: 'specialty' | 'secondary' | null;
  /** A language typed in ("Add another"). */
  newLanguage: string;
  uploading: boolean;
  touched: boolean;
  status: FormStatus;
  saveStatus: FormStatus;
  error: ServerError;
}

const initialState: DoctorProfileEditSliceState = {
  form: null,
  saved: null,
  serverErrors: {},
  newLanguage: '',
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

/** The API's field names → the form's ("experiences.1.fromYear" → "experience.1.from"). */
export const profileFieldKey = (apiField: string): string => {
  const m = /^(qualifications|experiences)\.(\d+)\.(\w+)$/.exec(apiField);
  if (m) {
    const row = m[1] === 'qualifications' ? 'qualification' : 'experience';
    const part = { designation: 'role', institute: m[1] === 'experiences' ? 'role' : 'institute', fromYear: 'from', toYear: 'to' }[m[3]] ?? m[3];
    return `${row}.${m[2]}.${part}`;
  }
  const top: Record<string, string> = {
    fullName: 'name',
    practicingSince: 'practisingSince',
    conditionIds: 'conditions',
    secondarySpecialtyIds: 'secondarySpecialtySlugs',
    primarySpecialtyId: 'specialtySlug',
  };
  return top[apiField] ?? apiField.split('.')[0];
};

export const doctorProfileEditSlice = createAppSlice({
  name: 'doctorProfileEdit',
  initialState,
  reducers: create => ({
    editProfile: create.reducer((state, action: PayloadAction<Partial<DoctorOwnProfile>>) => {
      if (state.form) state.form = { ...state.form, ...action.payload };
      // An edited field no longer carries the server's word.
      state.serverErrors = {};
    }),
    setNewLanguage: create.reducer((state, action: PayloadAction<string>) => {
      state.newLanguage = action.payload;
    }),
    addLanguage: create.reducer(state => {
      const l = state.newLanguage.trim();
      if (!state.form || l.length < 2) return;
      const name = l.charAt(0).toUpperCase() + l.slice(1);
      if (!state.form.languages.some(x => x.toLowerCase() === name.toLowerCase())) state.form.languages.push(name);
      state.newLanguage = '';
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
          const [profile, specialties, conditions] = await Promise.all([getOwnProfile(), fetchSpecialties(null), fetchConditions()]);
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
          state.saved = action.payload.profile;
          state.serverErrors = {};
          state.specialties = specialtiesSerializer(action.payload.specialties);
          state.conditions = conditionsSerializer(action.payload.conditions);
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
          // Saved on the server already: the photo isn't an unsaved change.
          if (state.form) state.form.photoUrl = action.payload.photoUrl;
          if (state.saved) state.saved.photoUrl = action.payload.photoUrl;
        },
        rejected: (state, action) => {
          state.uploading = false;
          const error = readRejection(action, "The photo didn't upload. Try again.");
          state.error = { ...error, message: errorCopy(error.code, error.details) ?? error.message };
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
          state.saved = action.payload;
          state.serverErrors = {};
        },
        rejected: (state, action) => {
          state.saveStatus = 'failed';
          const error = readRejection(action, "Your profile wasn't saved. Try again.");
          const fields = Object.fromEntries(Object.entries(fieldErrors(error.details)).map(([k, m]) => [profileFieldKey(k), m]));
          state.serverErrors = fields;
          state.error = {
            ...error,
            message: Object.keys(fields).length ? 'Check the highlighted fields.' : (errorCopy(error.code, error.details) ?? error.message),
          };
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
  setNewLanguage,
  addLanguage,
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
