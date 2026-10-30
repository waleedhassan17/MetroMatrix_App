// ═══════════════════════════════════════════════════════
// MetroMatrix — Profile slice
// ═══════════════════════════════════════════════════════
// Edit name and phone, upload an avatar (signed, direct to Cloudinary, with
// progress), and delete the account (Play policy: in-app deletion,
// confirmed with the password — or, for Google-only accounts, a typed
// "DELETE" and then a fresh Google sign-in).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { resetAllState } from '@store/resetAllState';
import { authDeleteAccount } from '@networks/auth/authNetwork';
import { updateMe } from '@networks/users/usersNetwork';
import { signUpload, uploadToCloudinary } from '@networks/media/mediaNetwork';
import { AuthError, toRejectedValue } from '@networks/network/apiHelpers';
import { getGoogleIdToken } from '@/services/googleAuth';
import { nationalFromPkPhone, toPkPhone } from '@models/authModel';
import { clearPushToken } from '@utils/storageUtils';
import { markIntentionalSignOut } from '@utils/authEvents';
import type { LocalFile, User } from '@/types';
import { setUser, signOut } from '../../Auth/authSlice';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../Auth/shared/formStatus';
import type { Touched } from '@utils/formErrors';
import { ERROR_CODES } from '@networks/network/errorCodes';

type Field = 'name' | 'phone';

/** The FYP profile's three tabs (Addresses is the customer's only). */
export type ProfileTab = 'overview' | 'addresses' | 'settings';

export interface ProfileSliceState {
  /** The user id the form was loaded from — reload when it changes. */
  loadedFor: string | null;
  tab: ProfileTab;
  name: string;
  phone: string;
  touched: Touched<Field>;
  saveStatus: FormStatus;
  avatarStatus: FormStatus;
  avatarProgress: number;
  deleteOpen: boolean;
  deleteConfirmation: string;
  deleteStatus: FormStatus;
  error: ServerError;
}

const initialState: ProfileSliceState = {
  loadedFor: null,
  tab: 'overview',
  name: '',
  phone: '',
  touched: {},
  saveStatus: 'idle',
  avatarStatus: 'idle',
  avatarProgress: 0,
  deleteOpen: false,
  deleteConfirmation: '',
  deleteStatus: 'idle',
  error: NO_ERROR,
};

export const profileSlice = createAppSlice({
  name: 'profile',
  initialState,
  reducers: create => ({
    loadFromUser: create.reducer((state, action: PayloadAction<User>) => {
      state.loadedFor = action.payload.id;
      state.name = action.payload.name;
      state.phone = nationalFromPkPhone(action.payload.phone);
      state.touched = {};
    }),
    setProfileTab: create.reducer((state, action: PayloadAction<ProfileTab>) => {
      state.tab = action.payload;
    }),
    setName: create.reducer((state, action: PayloadAction<string>) => {
      state.name = action.payload;
      state.saveStatus = 'idle';
    }),
    setPhone: create.reducer((state, action: PayloadAction<string>) => {
      state.phone = action.payload;
      state.saveStatus = 'idle';
    }),
    touch: create.reducer((state, action: PayloadAction<Field>) => {
      state.touched[action.payload] = true;
    }),
    setAvatarProgress: create.reducer((state, action: PayloadAction<number>) => {
      state.avatarProgress = action.payload;
    }),
    openDelete: create.reducer(state => {
      state.deleteOpen = true;
      state.deleteConfirmation = '';
      state.error = NO_ERROR;
    }),
    closeDelete: create.reducer(state => {
      state.deleteOpen = false;
      state.deleteConfirmation = '';
    }),
    setDeleteConfirmation: create.reducer((state, action: PayloadAction<string>) => {
      state.deleteConfirmation = action.payload;
    }),
    clearError: create.reducer(state => {
      state.error = NO_ERROR;
    }),

    saveProfileAsync: create.asyncThunk(
      async ({ name, phone }: { name: string; phone: string }, { dispatch, rejectWithValue }) => {
        try {
          const user = await updateMe({ name: name.trim(), phone: toPkPhone(phone) ?? null });
          dispatch(setUser(user));
          return user;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.saveStatus = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.saveStatus = 'succeeded';
          state.name = action.payload.name;
          state.phone = nationalFromPkPhone(action.payload.phone);
          state.touched = {};
        },
        rejected: (state, action) => {
          state.saveStatus = 'failed';
          state.error = readRejection(action, "We couldn't save your profile. Try again.");
        },
      },
    ),

    uploadAvatarAsync: create.asyncThunk(
      async (file: LocalFile, { dispatch, rejectWithValue }) => {
        try {
          const signed = await signUpload('avatar');
          const uploaded = await uploadToCloudinary(file, signed, p => dispatch(setAvatarProgress(p)));
          const user = await updateMe({ avatarUrl: uploaded.url });
          dispatch(setUser(user));
          return true;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.avatarStatus = 'loading';
          state.avatarProgress = 0;
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.avatarStatus = 'succeeded';
        },
        rejected: (state, action) => {
          state.avatarStatus = 'failed';
          state.error = readRejection(action, "We couldn't update your photo. Try again.");
        },
      },
    ),

    /**
     * `{ password }`, or `{ google: true }` for a Google-only account: after
     * the typed DELETE, Google is asked for a fresh ID token, which the API
     * checks belongs to this account. On success the account is gone: sign
     * out locally, no revoke call needed.
     */
    deleteAccountAsync: create.asyncThunk(
      async (confirmation: { password: string } | { google: true }, { dispatch, rejectWithValue }) => {
        try {
          if ('password' in confirmation) {
            await authDeleteAccount({ password: confirmation.password });
          } else {
            const idToken = await getGoogleIdToken();
            if (!idToken) throw new AuthError('Confirm with Google to delete your account.', ERROR_CODES.GOOGLE_CANCELLED);
            await authDeleteAccount({ idToken });
          }
          markIntentionalSignOut();
          await clearPushToken();
          dispatch(resetAllState());
          dispatch(signOut());
          return true;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.deleteStatus = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.deleteStatus = 'succeeded';
        },
        rejected: (state, action) => {
          state.deleteStatus = 'failed';
          const error = readRejection(action, "We couldn't delete your account. Try again.");
          state.error =
            error.code === ERROR_CODES.INVALID_CREDENTIALS
              ? {
                  ...error,
                  message:
                    'google' in action.meta.arg
                      ? 'That Google account is not the one linked to MetroMatrix.'
                      : 'That password is not correct.',
                }
              : error;
        },
      },
    ),
  }),

  selectors: {
    selectProfile: state => state,
  },
});

export const {
  loadFromUser,
  setProfileTab,
  setName,
  setPhone,
  touch,
  setAvatarProgress,
  openDelete,
  closeDelete,
  setDeleteConfirmation,
  clearError,
  saveProfileAsync,
  uploadAvatarAsync,
  deleteAccountAsync,
} = profileSlice.actions;

export const { selectProfile } = profileSlice.selectors;
