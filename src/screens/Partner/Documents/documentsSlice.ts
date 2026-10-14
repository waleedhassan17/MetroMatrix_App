// ═══════════════════════════════════════════════════════
// MetroMatrix — Verification documents slice
// ═══════════════════════════════════════════════════════
// Per document kind: pick → sign → upload straight to Cloudinary (progress)
// → record it on the business (addDocument). A failed upload keeps the
// picked file so Retry needs no second pick (QA 16).
//
// The picked file can be a Blob on web, which must not enter Redux (not
// serializable), so retry files live in a module-level map keyed by kind.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { addDocument, removeDocument } from '@networks/businesses/businessNetwork';
import { signUpload, uploadToCloudinary } from '@networks/media/mediaNetwork';
import { toRejectedValue } from '@networks/network/apiHelpers';
import type { DocumentKind, LocalFile } from '@/types';
import { setBusiness } from '../../Auth/authSlice';
import { NO_ERROR, readRejection, type ServerError } from '../../Auth/shared/formStatus';

export interface UploadState {
  status: 'uploading' | 'failed';
  progress: number;
  error: string | null;
  /** Shown as the tile thumbnail while uploading. */
  previewUri: string | null;
  isPdf: boolean;
}

export interface DocumentsSliceState {
  uploads: Partial<Record<DocumentKind, UploadState>>;
  /** The tile whose "add" sheet is open. */
  pickingFor: DocumentKind | null;
  removingId: string | null;
  viewer: { uri: string; title: string } | null;
  error: ServerError;
}

const initialState: DocumentsSliceState = {
  uploads: {},
  pickingFor: null,
  removingId: null,
  viewer: null,
  error: NO_ERROR,
};

const retryFiles = new Map<DocumentKind, LocalFile>();

/** The file a failed upload used, so Retry needs no second pick. */
export const retryFileFor = (kind: DocumentKind): LocalFile | undefined => retryFiles.get(kind);

export const documentsSlice = createAppSlice({
  name: 'documents',
  initialState,
  reducers: create => ({
    openPicker: create.reducer((state, action: PayloadAction<DocumentKind | null>) => {
      state.pickingFor = action.payload;
    }),
    setUploadProgress: create.reducer((state, action: PayloadAction<{ kind: DocumentKind; progress: number }>) => {
      const upload = state.uploads[action.payload.kind];
      if (upload) upload.progress = action.payload.progress;
    }),
    openViewer: create.reducer((state, action: PayloadAction<{ uri: string; title: string } | null>) => {
      state.viewer = action.payload;
    }),
    dismissError: create.reducer(state => {
      state.error = NO_ERROR;
    }),

    uploadDocumentAsync: create.asyncThunk(
      async ({ kind, file }: { kind: DocumentKind; file: LocalFile }, { dispatch, rejectWithValue }) => {
        retryFiles.set(kind, file);
        try {
          const signed = await signUpload('business_document');
          const uploaded = await uploadToCloudinary(file, signed, progress =>
            dispatch(setUploadProgress({ kind, progress })),
          );
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
        pending: (state, action) => {
          state.removingId = action.meta.arg;
          state.error = NO_ERROR;
        },
        fulfilled: state => {
          state.removingId = null;
        },
        rejected: (state, action) => {
          state.removingId = null;
          state.error = readRejection(action, "We couldn't remove that document.");
        },
      },
    ),
  }),

  selectors: {
    selectDocuments: state => state,
  },
});

export const {
  openPicker,
  setUploadProgress,
  openViewer,
  dismissError,
  uploadDocumentAsync,
  removeDocumentAsync,
} = documentsSlice.actions;

export const { selectDocuments } = documentsSlice.selectors;
