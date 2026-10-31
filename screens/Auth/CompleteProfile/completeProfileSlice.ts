// ═══════════════════════════════════════════════════════
// MetroMatrix — Complete Profile slice (users, the FYP's three steps)
// ═══════════════════════════════════════════════════════
//   1 Personal   date of birth, gender
//   2 Location   street address, city, postal code (optional)
//   3 Photo      optional — uploaded on pick (signed, direct, with progress)
// "Complete Registration" / "Skip for now" saves all of it in one
// PATCH /users/me/profile, which marks the profile complete; the session
// gate then opens the customer app.
//
// A picked photo can be a Blob on web, which must not enter Redux, so the
// file a failed upload used lives in a module-level slot for Retry.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../store/createAppSlice';
import { completeProfileAPI } from '../../../networks/users/usersNetwork';
import { signUpload } from '../../../services/mediaUpload';
import { uploadToCloudinary, toRejectedValue, required } from '../../../networks/network/apiHelpers';
import type { Gender, LocalFile } from '../../../types';
import type { Touched } from '../../../utils/formErrors';
import { setUser } from '../authSlice';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { userResponseSerializer } from '../../../serializers/authSerializer';

export type ProfileStep = 1 | 2 | 3;
export type ProfileField = 'dateOfBirth' | 'gender' | 'streetAddress' | 'city' | 'postalCode';

export interface CompleteProfileSliceState {
  step: ProfileStep;
  dateOfBirth: string;
  gender: Gender | null;
  streetAddress: string;
  city: string;
  postalCode: string;
  touched: Touched<ProfileField>;
  photo: {
    status: 'idle' | 'uploading' | 'uploaded' | 'failed';
    progress: number;
    previewUri: string | null;
    url: string | null;
    error: string | null;
  };
  status: FormStatus;
  error: ServerError;
}

const NO_PHOTO: CompleteProfileSliceState['photo'] = {
  status: 'idle',
  progress: 0,
  previewUri: null,
  url: null,
  error: null,
};

const initialState: CompleteProfileSliceState = {
  step: 1,
  dateOfBirth: '',
  gender: null,
  streetAddress: '',
  city: '',
  postalCode: '',
  touched: {},
  photo: NO_PHOTO,
  status: 'idle',
  error: NO_ERROR,
};

let retryPhoto: LocalFile | null = null;
export const retryPhotoFile = (): LocalFile | null => retryPhoto;

const STEP_FIELDS: Record<ProfileStep, ProfileField[]> = {
  1: ['dateOfBirth', 'gender'],
  2: ['streetAddress', 'city', 'postalCode'],
  3: [],
};

export const completeProfileSlice = createAppSlice({
  name: 'completeProfile',
  initialState,
  reducers: create => ({
    setField: create.reducer(
      (state, action: PayloadAction<{ field: Exclude<ProfileField, 'gender'>; value: string }>) => {
        state[action.payload.field] = action.payload.value;
        state.error = NO_ERROR;
      },
    ),
    setGender: create.reducer((state, action: PayloadAction<Gender>) => {
      state.gender = action.payload;
      state.touched.gender = true;
    }),
    touch: create.reducer((state, action: PayloadAction<ProfileField>) => {
      state.touched[action.payload] = true;
    }),
    touchStep: create.reducer(state => {
      for (const f of STEP_FIELDS[state.step]) state.touched[f] = true;
    }),
    goToStep: create.reducer((state, action: PayloadAction<ProfileStep>) => {
      state.step = action.payload;
      state.error = NO_ERROR;
    }),
    setPhotoProgress: create.reducer((state, action: PayloadAction<number>) => {
      state.photo.progress = action.payload;
    }),
    removePhoto: create.reducer(state => {
      state.photo = NO_PHOTO;
      retryPhoto = null;
    }),

    uploadPhotoAsync: create.asyncThunk(
      async (file: LocalFile, { dispatch, rejectWithValue }) => {
        retryPhoto = file;
        try {
          const signed = await signUpload('avatar');
          const uploaded = await uploadToCloudinary(file, signed, p => dispatch(setPhotoProgress(p)));
          retryPhoto = null;
          return uploaded.url;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.photo = { ...NO_PHOTO, status: 'uploading', previewUri: action.meta.arg.uri };
        },
        fulfilled: (state, action) => {
          state.photo.status = 'uploaded';
          state.photo.progress = 1;
          state.photo.url = action.payload;
        },
        rejected: (state, action) => {
          state.photo.status = 'failed';
          state.photo.error = readRejection(action, 'Upload failed. Try again.').message;
        },
      },
    ),

    submitProfileAsync: create.asyncThunk(
      async (
        payload: {
          dateOfBirth: string;
          gender: Gender;
          streetAddress: string;
          city: string;
          postalCode: string;
          avatarUrl: string | null;
        },
        { dispatch, rejectWithValue },
      ) => {
        try {
          const raw = await completeProfileAPI({
            dateOfBirth: payload.dateOfBirth,
            gender: payload.gender,
            streetAddress: payload.streetAddress.trim(),
            city: payload.city,
            postalCode: payload.postalCode.trim() || undefined,
            avatarUrl: payload.avatarUrl,
          });
          dispatch(setUser(required(userResponseSerializer(raw))));
          return true;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.status = 'succeeded';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't save your profile. Try again.");
          // Field errors from the server land on the step that owns them.
          const fields = Object.keys(state.error.details?.fields ?? {});
          if (fields.some(f => STEP_FIELDS[1].includes(f as ProfileField))) state.step = 1;
          else if (fields.some(f => STEP_FIELDS[2].includes(f as ProfileField))) state.step = 2;
        },
      },
    ),
  }),
  selectors: {
    selectCompleteProfile: state => state,
  },
});

export const {
  setField,
  setGender,
  touch,
  touchStep,
  goToStep,
  setPhotoProgress,
  removePhoto,
  uploadPhotoAsync,
  submitProfileAsync,
} = completeProfileSlice.actions;
export const { selectCompleteProfile } = completeProfileSlice.selectors;
