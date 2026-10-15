// ═══════════════════════════════════════════════════════
// MetroMatrix — Personal Info slice (providers, the FYP's three steps)
// ═══════════════════════════════════════════════════════
//   1 Personal       name, phone (email shown, fixed)   → PATCH /users/me
//   2 Professional   the sub-type's schema (businessModel) → create / PATCH
//                    the draft, so a provider who leaves resumes it
//   3 Documents      CNIC + the sub-type's papers, uploaded on pick
//                    (signed, direct, progress, retry)
// Submit → POST /businesses/me/submit → pending_approval, and the gate opens
// Provider Approval Pending. 422 DOCUMENTS_MISSING highlights the tiles the
// server named. A rejected application comes back here to fix and resubmit.
//
// Picked files can be Blobs on web, which must not enter Redux, so the file a
// failed upload used lives in a module-level map for Retry.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { updateMe } from '@networks/users/usersNetwork';
import { addDocument, createBusiness, removeDocument, submitBusiness, updateMyBusiness } from '@networks/businesses/businessNetwork';
import { signUpload, uploadToCloudinary } from '@networks/media/mediaNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import { nationalFromPkPhone, toPkPhone } from '@models/authModel';
import {
  businessProfileToPayload,
  businessToProfileForm,
  emptyBusinessProfile,
  type BusinessProfileForm,
  type DetailKey,
} from '@models/businessModel';
import type { Business, DocumentKind, LocalFile, ServiceType, SubType, User } from '@/types';
import { setBusiness, setUser } from '../../Auth/authSlice';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../Auth/shared/formStatus';

export type InfoStep = 1 | 2 | 3;
type CoreField = 'name' | 'city' | 'address';
export type BasicField = 'fullName' | 'phone';
export type InfoField = BasicField | CoreField | DetailKey;

export interface UploadState {
  status: 'uploading' | 'failed';
  progress: number;
  error: string | null;
  previewUri: string | null;
  isPdf: boolean;
}

export interface PersonalInfoSliceState {
  /** Which account + business the form was filled from. */
  loadedFor: string | null;
  step: InfoStep;
  fullName: string;
  phone: string;
  form: BusinessProfileForm;
  touched: Partial<Record<InfoField, boolean>>;
  picker: 'city' | DetailKey | null;
  uploads: Partial<Record<DocumentKind, UploadState>>;
  pickingFor: DocumentKind | null;
  viewer: { uri: string; title: string } | null;
  /** Tiles the server said are missing. */
  highlight: DocumentKind[];
  status: FormStatus;
  submitStatus: FormStatus;
  error: ServerError;
}

const initialState: PersonalInfoSliceState = {
  loadedFor: null,
  step: 1,
  fullName: '',
  phone: '',
  form: emptyBusinessProfile(),
  touched: {},
  picker: null,
  uploads: {},
  pickingFor: null,
  viewer: null,
  highlight: [],
  status: 'idle',
  submitStatus: 'idle',
  error: NO_ERROR,
};

const retryFiles = new Map<DocumentKind, LocalFile>();
export const retryFileFor = (kind: DocumentKind): LocalFile | undefined => retryFiles.get(kind);

const loading = (state: PersonalInfoSliceState) => {
  state.status = 'loading';
  state.error = NO_ERROR;
};

export const personalInfoSlice = createAppSlice({
  name: 'personalInfo',
  initialState,
  reducers: create => ({
    /** Fill from the account and any saved draft; resume at the first unfinished step. */
    initialise: create.reducer(
      (state, action: PayloadAction<{ user: User; business: Business | null; step?: InfoStep; highlight?: DocumentKind[] }>) => {
        const { user, business, step, highlight } = action.payload;
        const key = `${user.id}:${business?.id ?? 'new'}`;
        if (state.loadedFor !== key) {
          state.loadedFor = key;
          state.fullName = user.name;
          state.phone = nationalFromPkPhone(user.phone);
          state.form = business ? businessToProfileForm(business) : emptyBusinessProfile();
          state.touched = {};
          state.error = NO_ERROR;
          state.step = business?.name && business.city && business.address ? 3 : user.phone ? (business ? 2 : 1) : 1;
        }
        if (step) state.step = step;
        if (highlight?.length) state.highlight = highlight;
      },
    ),
    setBasic: create.reducer((state, action: PayloadAction<{ field: BasicField; value: string }>) => {
      state[action.payload.field] = action.payload.value;
      state.error = NO_ERROR;
    }),
    setCoreField: create.reducer((state, action: PayloadAction<{ field: CoreField; value: string }>) => {
      state.form[action.payload.field] = action.payload.value;
      state.error = NO_ERROR;
    }),
    setDetail: create.reducer((state, action: PayloadAction<{ key: DetailKey; value: string }>) => {
      state.form.details[action.payload.key] = action.payload.value;
      state.error = NO_ERROR;
    }),
    touch: create.reducer((state, action: PayloadAction<InfoField>) => {
      state.touched[action.payload] = true;
    }),
    touchFields: create.reducer((state, action: PayloadAction<InfoField[]>) => {
      for (const f of action.payload) state.touched[f] = true;
    }),
    goToStep: create.reducer((state, action: PayloadAction<InfoStep>) => {
      state.step = action.payload;
      state.error = NO_ERROR;
    }),
    openPicker: create.reducer((state, action: PayloadAction<'city' | DetailKey | null>) => {
      state.picker = action.payload;
    }),
    openDocumentPicker: create.reducer((state, action: PayloadAction<DocumentKind | null>) => {
      state.pickingFor = action.payload;
    }),
    openViewer: create.reducer((state, action: PayloadAction<{ uri: string; title: string } | null>) => {
      state.viewer = action.payload;
    }),
    setUploadProgress: create.reducer((state, action: PayloadAction<{ kind: DocumentKind; progress: number }>) => {
      const upload = state.uploads[action.payload.kind];
      if (upload) upload.progress = action.payload.progress;
    }),
    dismissError: create.reducer(state => {
      state.error = NO_ERROR;
    }),

    /** Step 1 → PATCH /users/me (only when something changed). */
    saveBasicsAsync: create.asyncThunk(
      async ({ user, fullName, phone }: { user: User; fullName: string; phone: string }, { dispatch, rejectWithValue }) => {
        try {
          const canonical = toPkPhone(phone) ?? null;
          if (fullName.trim() !== user.name || canonical !== user.phone) {
            dispatch(setUser(await updateMe({ name: fullName.trim(), phone: canonical })));
          }
          return true;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: loading,
        fulfilled: state => {
          state.status = 'idle';
          state.step = 2;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't save your details. Try again.");
        },
      },
    ),

    /** Step 2 → create the draft the first time, PATCH it after. */
    saveProfessionalAsync: create.asyncThunk(
      async (
        args: { business: Business | null; serviceType: ServiceType; subType: SubType; form: BusinessProfileForm; phone: string },
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
        pending: loading,
        fulfilled: (state, action) => {
          state.status = 'idle';
          state.step = 3;
          const [userId] = (state.loadedFor ?? '').split(':');
          state.loadedFor = `${userId}:${action.payload}`;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't save your details. Try again.");
        },
      },
    ),

    uploadDocumentAsync: create.asyncThunk(
      async ({ kind, file }: { kind: DocumentKind; file: LocalFile }, { dispatch, rejectWithValue }) => {
        retryFiles.set(kind, file);
        try {
          const signed = await signUpload('business_document');
          const uploaded = await uploadToCloudinary(file, signed, progress => dispatch(setUploadProgress({ kind, progress })));
          const business = await addDocument({
            kind,
            url: uploaded.url,
            publicId: uploaded.publicId,
            mimeType: uploaded.mimeType,
          });
          dispatch(setBusiness(business));
          retryFiles.delete(kind);
          return kind;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const { kind, file } = action.meta.arg;
          state.pickingFor = null;
          state.uploads[kind] = {
            status: 'uploading',
            progress: 0,
            error: null,
            previewUri: file.mimeType.startsWith('image/') ? file.uri : null,
            isPdf: file.mimeType === 'application/pdf',
          };
        },
        fulfilled: (state, action) => {
          delete state.uploads[action.payload];
          state.highlight = state.highlight.filter(k => k !== action.payload);
        },
        rejected: (state, action) => {
          const upload = state.uploads[action.meta.arg.kind];
          if (upload) {
            upload.status = 'failed';
            upload.error = readRejection(action, 'Upload failed. Try again.').message;
          }
        },
      },
    ),

    removeDocumentAsync: create.asyncThunk(
      async (documentId: string, { dispatch, rejectWithValue }) => {
        try {
          dispatch(setBusiness(await removeDocument(documentId)));
          return documentId;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        rejected: (state, action) => {
          state.error = readRejection(action, "We couldn't remove that document.");
        },
      },
    ),

    submitApplicationAsync: create.asyncThunk(
      async (_: void, { dispatch, rejectWithValue }) => {
        try {
          dispatch(setBusiness(await submitBusiness()));
          return true;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.submitStatus = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.submitStatus = 'succeeded';
          state.highlight = [];
        },
        rejected: (state, action) => {
          state.submitStatus = 'failed';
          state.error = readRejection(action, "We couldn't submit your application. Try again.");
          const missing = state.error.details?.missing;
          if (Array.isArray(missing)) {
            state.highlight = missing as DocumentKind[];
            state.step = 3;
          }
        },
      },
    ),
  }),
  selectors: {
    selectPersonalInfo: state => state,
  },
});

export const {
  initialise,
  setBasic,
  setCoreField,
  setDetail,
  touch,
  touchFields,
  goToStep,
  openPicker,
  openDocumentPicker,
  openViewer,
  setUploadProgress,
  dismissError,
  saveBasicsAsync,
  saveProfessionalAsync,
  uploadDocumentAsync,
  removeDocumentAsync,
  submitApplicationAsync,
} = personalInfoSlice.actions;
export const { selectPersonalInfo } = personalInfoSlice.selectors;
