// ═══════════════════════════════════════════════════════
// MetroMatrix — Personal Info slice (providers, the FYP's three steps)
// ═══════════════════════════════════════════════════════
//   1 Personal       name, phone (email shown, fixed)   → PATCH /users/me
//   2 Professional   the sub-type's schema (businessModel) → create / PATCH
//                    the draft, so a provider who leaves resumes it
//   3 Documents      one tile per slot (businessModel.documentSlots): CNIC
//                    front and back plus the sub-type's papers, uploaded on
//                    pick (signed, direct, progress, retry)
// Submit → POST /businesses/me/submit → pending_approval, and the gate opens
// Provider Approval Pending. 422 DOCUMENTS_MISSING highlights the tiles of the
// requirements the server named (`details.missing`: `kind` or `a|b`). A
// rejected application comes back here to fix and resubmit.
//
// Uploads are keyed by SLOT, not kind: a home kitchen has two kitchen-photo
// slots, and a store's "NTN certificate or shop photo" slot takes either kind.
// Picked files can be Blobs on web, which must not enter Redux, so the file a
// failed upload used lives in a module-level map for Retry.
//
// Safe to retry on a slow link (the 2026-11-24 QA):
//   • POST /businesses, /businesses/me/documents and /businesses/me/submit
//     carry an Idempotency-Key kept across a retry, so the API replays the
//     first answer instead of creating, attaching or submitting twice;
//   • a create answered BUSINESS_EXISTS (the first one worked) adopts the
//     saved business and saves this form onto it;
//   • a submit that timed out, or a second tap told INVALID_TRANSITION, reads
//     the account: if it went through, the gate moves to Approval Pending;
//   • a retried upload whose file already reached Cloudinary only records it;
//   • uploads run one at a time, so the business each one reads back can't
//     overwrite a newer one;
//   • a failed tile can take a different file ("Choose another file").
// Server field errors land on the step and field that own them.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { updateMe } from '../../networks/users/users';
import {
  addDocument,
  createBusiness,
  fetchMyBusiness,
  removeDocument,
  submitBusiness,
  updateMyBusiness,
} from '../../networks/businesses/business';
import { signUpload } from '../../services/mediaUpload';
import {
  ApiError,
  ERROR_CODES,
  errorCopy,
  fieldErrors,
  uploadToCloudinary,
  toApiError,
  toRejectedValue,
  required,
} from '../../networks/network/network';
import { me } from '../../networks/authcalls/me';
import { nationalFromPkPhone, toPkPhone, updateMeBody } from '../../models/authModel';
import {
  businessProfileToPayload,
  businessToProfileForm,
  emptyBusinessProfile,
  type BusinessProfileForm,
  type DetailKey,
} from '../../models/businessModel';
import type { Business, DocumentKind, LocalFile, ServiceType, SubType, UploadedFile, User } from '../../models';
import { setBusiness, setSession, setUser } from '../../store/authSlice';
import { newUuid } from '../../utils/ids/ids';
import { stillSignedIn } from '../shared/sessionGuard';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { userResponseSerializer } from '../../serializers/authSerializer';
import { businessSerializer } from '../../serializers/businessSerializer';

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
  /** By slot key (businessModel.DocumentSlot.key). */
  uploads: Partial<Record<string, UploadState>>;
  /** The slot whose picker sheet is open, the kinds it takes and the one chosen. */
  pickingFor: { slot: string; kinds: DocumentKind[]; kind: DocumentKind; replacing: string | null } | null;
  viewer: { uri: string; title: string } | null;
  /** Requirement keys the server said are missing (`kind` or `a|b`). */
  highlight: string[];
  status: FormStatus;
  submitStatus: FormStatus;
  error: ServerError;
  /** The server's word on a field (VALIDATION_FAILED), shown until it is edited. */
  serverErrors: Partial<Record<InfoField, string>>;
  /** POST /businesses' Idempotency-Key, kept while a create never answered. */
  createKey: string | null;
  /** POST /businesses/me/submit's, likewise. */
  submitKey: string | null;
  /** Documents whose removal is on the wire (a second tap does nothing). */
  removing: string[];
  /** The camera or photos permission was refused: say so and offer Settings. */
  permissionDenied: 'camera' | 'photos' | null;
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
  serverErrors: {},
  createKey: null,
  submitKey: null,
  removing: [],
  permissionDenied: null,
};

export interface DocumentUpload {
  /** The slot the tile shows (DocumentSlot.key). */
  slot: string;
  kind: DocumentKind;
  file: LocalFile;
  /** The document this upload replaces in its slot, removed once the new one is in. */
  replacing: string | null;
  /** addDocument's Idempotency-Key: one per file, kept across its retries. */
  key?: string;
  /** Set once the file reached Cloudinary: a retry only records it. */
  uploaded?: UploadedFile;
}

const retryFiles = new Map<string, DocumentUpload>();
export const retryUploadFor = (slot: string): DocumentUpload | undefined => retryFiles.get(slot);
/** "Choose another file": the failed file is let go, so the slot takes a new pick. */
export const forgetUpload = (slot: string): void => {
  retryFiles.delete(slot);
};

/** One upload at a time: each reads the business back, and an older read must not land last. */
let uploadChain: Promise<unknown> = Promise.resolve();
const oneAtATime = <T>(job: () => Promise<T>): Promise<T> => {
  const run = uploadChain.then(job, job);
  uploadChain = run.catch(() => undefined);
  return run;
};

/** Which server field belongs to which form field (and so to which step). */
const SERVER_FIELD: Record<string, InfoField> = {
  displayName: 'fullName',
  phone: 'phone',
  name: 'name',
  city: 'city',
  addressLine: 'address',
  pmdcNumber: 'pmdcNumber' as DetailKey,
};
const STEP_OF: Partial<Record<InfoField, InfoStep>> = { fullName: 1, phone: 1, name: 2, city: 2, address: 2 };

/** The form's fill key: who, which business, and whether the full business is in yet. */
export const fillKey = (user: Pick<User, 'id'>, business: Pick<Business, 'id' | 'address'> | null): string =>
  `${user.id}:${business?.id ?? 'new'}:${business ? (business.address ? 'full' : 'summary') : 'none'}`;

/**
 * After a submit that may have gone through: the account is read, and if the
 * business is no longer draft or rejected the gate moves on. True when it did.
 */
const adoptIfSubmitted = async (dispatch: (a: unknown) => unknown): Promise<boolean> => {
  try {
    const session = await me();
    const status = session.business?.status;
    if (status && status !== 'draft' && status !== 'rejected') {
      if (await stillSignedIn()) dispatch(setSession(session));
      return true;
    }
  } catch {
    /* the original error stands */
  }
  return false;
};

const loading = (state: PersonalInfoSliceState) => {
  state.status = 'loading';
  state.error = NO_ERROR;
};

/** A save that failed: the server's field errors go to their fields (and step), the rest to the notice. */
const saveFailed = (state: PersonalInfoSliceState, error: ServerError) => {
  state.status = 'failed';
  const fields: Partial<Record<InfoField, string>> = {};
  for (const [field, message] of Object.entries(fieldErrors(error.details))) {
    const own = SERVER_FIELD[field];
    if (own) fields[own] = message;
  }
  state.serverErrors = fields;
  const steps = Object.keys(fields)
    .map(f => STEP_OF[f as InfoField] ?? 2)
    .sort();
  if (steps.length) state.step = steps[0];
  const copy = errorCopy(error.code, error.details) ?? error.message;
  state.error = { ...error, message: steps.length ? 'Check the highlighted fields.' : copy };
};

export const personalInfoSlice = createAppSlice({
  name: 'personalInfo',
  initialState,
  reducers: create => ({
    /** Fill from the account and any saved draft; resume at the first unfinished step. */
    initialise: create.reducer(
      (state, action: PayloadAction<{ user: User; business: Business | null; step?: InfoStep; highlight?: string[] }>) => {
        const { user, business, step, highlight } = action.payload;
        const key = fillKey(user, business);
        if (state.loadedFor !== key) {
          state.loadedFor = key;
          state.fullName = user.name;
          state.phone = nationalFromPkPhone(user.phone);
          state.form = business ? businessToProfileForm(business) : emptyBusinessProfile();
          state.touched = {};
          state.serverErrors = {};
          state.error = NO_ERROR;
          state.step = business?.name && business.city && business.address ? 3 : user.phone ? (business ? 2 : 1) : 1;
        }
        if (step) state.step = step;
        if (highlight?.length) state.highlight = highlight;
      },
    ),
    setBasic: create.reducer((state, action: PayloadAction<{ field: BasicField; value: string }>) => {
      state[action.payload.field] = action.payload.value;
      delete state.serverErrors[action.payload.field];
      state.error = NO_ERROR;
    }),
    setCoreField: create.reducer((state, action: PayloadAction<{ field: CoreField; value: string }>) => {
      state.form[action.payload.field] = action.payload.value;
      delete state.serverErrors[action.payload.field];
      state.error = NO_ERROR;
    }),
    setDetail: create.reducer((state, action: PayloadAction<{ key: DetailKey; value: string }>) => {
      state.form.details[action.payload.key] = action.payload.value;
      delete state.serverErrors[action.payload.key];
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
    openDocumentPicker: create.reducer(
      (state, action: PayloadAction<{ slot: string; kinds: DocumentKind[]; replacing: string | null } | null>) => {
        const p = action.payload;
        state.pickingFor = p ? { ...p, kind: p.kinds[0] } : null;
      },
    ),
    /** An either-or slot: which kind this file is. */
    choosePickingKind: create.reducer((state, action: PayloadAction<DocumentKind>) => {
      if (state.pickingFor?.kinds.includes(action.payload)) state.pickingFor.kind = action.payload;
    }),
    openViewer: create.reducer((state, action: PayloadAction<{ uri: string; title: string } | null>) => {
      state.viewer = action.payload;
    }),
    setUploadProgress: create.reducer((state, action: PayloadAction<{ slot: string; progress: number }>) => {
      const upload = state.uploads[action.payload.slot];
      if (upload) upload.progress = action.payload.progress;
    }),
    dismissError: create.reducer(state => {
      state.error = NO_ERROR;
    }),
    setPermissionDenied: create.reducer((state, action: PayloadAction<'camera' | 'photos' | null>) => {
      state.permissionDenied = action.payload;
    }),
    /** "Choose another file" on a failed tile: the slot is empty again (pair with forgetUpload). */
    discardUpload: create.reducer((state, action: PayloadAction<string>) => {
      delete state.uploads[action.payload];
    }),

    /** Step 1 → PATCH /users/me (only when something changed). */
    saveBasicsAsync: create.asyncThunk(
      async ({ user, fullName, phone }: { user: User; fullName: string; phone: string }, { dispatch, rejectWithValue }) => {
        try {
          const canonical = toPkPhone(phone) ?? null;
          if (fullName.trim() !== user.name || canonical !== user.phone) {
            dispatch(setUser(required(userResponseSerializer(await updateMe(updateMeBody({ name: fullName, phone: canonical }))))));
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
          state.serverErrors = {};
          state.step = 2;
        },
        rejected: (state, action) => {
          saveFailed(state, readRejection(action, "We couldn't save your details. Try again."));
        },
      },
    ),

    /**
     * Step 2 → create the draft the first time, PATCH it after. The create
     * carries `createKey` (nextCreateKey); BUSINESS_EXISTS means an earlier
     * create worked, so this form is saved onto that business.
     */
    saveProfessionalAsync: create.asyncThunk(
      async (
        args: {
          business: Business | null;
          serviceType: ServiceType;
          subType: SubType;
          form: BusinessProfileForm;
          phone: string;
          createKey: string;
        },
        { dispatch, rejectWithValue },
      ) => {
        try {
          const payload = businessProfileToPayload(args.serviceType, args.subType, args.form, args.phone);
          let raw: unknown;
          if (args.business) raw = await updateMyBusiness(payload);
          else {
            try {
              raw = await createBusiness(payload, args.createKey);
            } catch (e) {
              if (!(e instanceof ApiError && e.code === ERROR_CODES.BUSINESS_EXISTS)) throw e;
              raw = await updateMyBusiness(payload);
            }
          }
          const saved = required(businessSerializer(raw));
          if (await stillSignedIn()) dispatch(setBusiness(saved));
          return saved.id;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          loading(state);
          if (!action.meta.arg.business) state.createKey = action.meta.arg.createKey;
        },
        fulfilled: (state, action) => {
          state.status = 'idle';
          state.serverErrors = {};
          state.createKey = null;
          state.step = 3;
          const [userId] = (state.loadedFor ?? '').split(':');
          state.loadedFor = `${userId}:${action.payload}:full`;
        },
        rejected: (state, action) => {
          const error = readRejection(action, "We couldn't save your details. Try again.");
          if (error.code !== ERROR_CODES.NETWORK_ERROR) state.createKey = null;
          saveFailed(state, error);
        },
      },
    ),

    uploadDocumentAsync: create.asyncThunk(
      async (upload: DocumentUpload, { dispatch, rejectWithValue }) => {
        const { slot, kind, replacing } = upload;
        // One key per file, kept by its retries (the API replays a repeated key).
        const attempt: DocumentUpload = { ...upload, key: upload.key ?? newUuid() };
        retryFiles.set(slot, attempt);
        return oneAtATime(async () => {
          try {
            // A retry whose file already reached Cloudinary only records it.
            if (!attempt.uploaded) {
              const signed = await signUpload('business_document');
              attempt.uploaded = await uploadToCloudinary(attempt.file, signed, progress =>
                dispatch(setUploadProgress({ slot, progress })),
              );
            }
            const { url, publicId } = attempt.uploaded;
            // The API answers the one document: the business is read again for
            // the new list and requirement statuses.
            await addDocument({ kind, url, publicId }, attempt.key);
            let business = required(businessSerializer(await fetchMyBusiness()));
            // A single-copy kind is replaced by the API itself; kitchen and shop
            // photos add up, so the one this upload replaces goes now.
            if (replacing && business.documents.some(d => d.id === replacing)) {
              await removeDocument(replacing);
              business = required(businessSerializer(await fetchMyBusiness()));
            }
            if (await stillSignedIn()) dispatch(setBusiness(business));
            retryFiles.delete(slot);
            return slot;
          } catch (e) {
            return rejectWithValue(toRejectedValue(e));
          }
        });
      },
      {
        pending: (state, action) => {
          const { slot, file } = action.meta.arg;
          state.pickingFor = null;
          state.uploads[slot] = {
            status: 'uploading',
            progress: 0,
            error: null,
            previewUri: file.mimeType.startsWith('image/') ? file.uri : null,
            isPdf: file.mimeType === 'application/pdf',
          };
        },
        fulfilled: (state, action) => {
          delete state.uploads[action.payload];
          const { kind } = action.meta.arg;
          // The requirement this kind meets may now be met; the screen re-evaluates.
          state.highlight = state.highlight.filter(k => !k.split('|').includes(kind));
        },
        rejected: (state, action) => {
          const upload = state.uploads[action.meta.arg.slot];
          if (upload) {
            upload.status = 'failed';
            const error = readRejection(action, 'Upload failed. Try again.');
            upload.error = errorCopy(error.code, error.details) ?? error.message;
          }
        },
      },
    ),

    removeDocumentAsync: create.asyncThunk(
      async (documentId: string, { dispatch, rejectWithValue }) => {
        try {
          await removeDocument(documentId);
          const business = required(businessSerializer(await fetchMyBusiness()));
          if (await stillSignedIn()) dispatch(setBusiness(business));
          return documentId;
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        options: {
          condition: (documentId, { getState }) =>
            !(getState() as { personalInfo: PersonalInfoSliceState }).personalInfo.removing.includes(documentId),
        },
        pending: (state, action) => {
          state.removing.push(action.meta.arg);
        },
        fulfilled: (state, action) => {
          state.removing = state.removing.filter(id => id !== action.payload);
        },
        rejected: (state, action) => {
          if (action.meta.condition) return;
          state.removing = state.removing.filter(id => id !== action.meta.arg);
          const error = readRejection(action, "We couldn't remove that document.");
          state.error = { ...error, message: errorCopy(error.code, error.details) ?? error.message };
        },
      },
    ),

    /**
     * Submit (or resubmit). Carries `key` (nextSubmitKey). A submit that timed
     * out, or a second tap told INVALID_TRANSITION, may have gone through: the
     * account is read and, if so, the gate moves to Approval Pending.
     */
    submitApplicationAsync: create.asyncThunk(
      async ({ key }: { key: string }, { dispatch, rejectWithValue }) => {
        try {
          const business = required(businessSerializer(await submitBusiness(key)));
          if (await stillSignedIn()) dispatch(setBusiness(business));
          return true;
        } catch (e) {
          const code = toApiError(e).code;
          if ((code === ERROR_CODES.INVALID_TRANSITION || code === ERROR_CODES.NETWORK_ERROR) && (await adoptIfSubmitted(dispatch))) {
            return true;
          }
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.submitStatus = 'loading';
          state.submitKey = action.meta.arg.key;
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.submitStatus = 'succeeded';
          state.submitKey = null;
          state.highlight = [];
        },
        rejected: (state, action) => {
          state.submitStatus = 'failed';
          const error = readRejection(action, "We couldn't submit your application. Try again.");
          if (error.code !== ERROR_CODES.NETWORK_ERROR) state.submitKey = null;
          state.error = { ...error, message: errorCopy(error.code, error.details) ?? error.message };
          const missing = state.error.details?.missing;
          if (Array.isArray(missing)) {
            state.highlight = missing.filter((k): k is string => typeof k === 'string');
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
  choosePickingKind,
  openViewer,
  setUploadProgress,
  dismissError,
  discardUpload,
  setPermissionDenied,
  saveBasicsAsync,
  saveProfessionalAsync,
  uploadDocumentAsync,
  removeDocumentAsync,
  submitApplicationAsync,
} = personalInfoSlice.actions;
export const { selectPersonalInfo } = personalInfoSlice.selectors;

/** The create's key: the one a create that never answered kept, else a fresh one. */
export const nextCreateKey = (state: PersonalInfoSliceState): string => state.createKey ?? newUuid();
/** The submit's key, likewise. */
export const nextSubmitKey = (state: PersonalInfoSliceState): string => state.submitKey ?? newUuid();
