// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: signature dishes slice
// ═══════════════════════════════════════════════════════
// Dishes kitchens mark as their signature: new ones to look at, kept ones,
// and ones staff took the label off with a note the kitchen sees.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { approveSignature, fetchSignatures, removeSignature } from '../../networks/admin/adminKitchen';
import { toRejectedValue } from '../../networks/network/network';
import type { SignatureDish, SignatureList, SignatureStatus } from '../../models';
import {
  NO_ERROR,
  readRejection,
  type FormStatus,
  type ServerError,
} from '../shared/formStatus';
import { signatureListSerializer } from '../../serializers/kitchen/adminKitchenSerializer';

export interface AdminKitchenSignaturesSliceState {
  tab: SignatureStatus;
  list: SignatureList | null;
  status: FormStatus;
  error: ServerError;
  removing: Pick<SignatureDish, 'itemId' | 'name'> | null;
  note: string;
  submitted: boolean;
  busy: string | null;
  actionError: ServerError;
}

const initialState: AdminKitchenSignaturesSliceState = {
  tab: 'new',
  list: null,
  status: 'idle',
  error: NO_ERROR,
  removing: null,
  note: '',
  submitted: false,
  busy: null,
  actionError: NO_ERROR,
};

export const adminKitchenSignaturesSlice = createAppSlice({
  name: 'adminKitchenSignatures',
  initialState,
  reducers: create => ({
    setSignaturesTab: create.reducer((state, action: PayloadAction<SignatureStatus>) => {
      state.tab = action.payload;
    }),
    openRemoveNote: create.reducer((state, action: PayloadAction<Pick<SignatureDish, 'itemId' | 'name'> | null>) => {
      state.removing = action.payload;
      state.note = '';
      state.submitted = false;
      state.actionError = NO_ERROR;
    }),
    setRemoveNote: create.reducer((state, action: PayloadAction<string>) => {
      state.note = action.payload.slice(0, 300);
    }),
    markRemoveSubmitted: create.reducer(state => {
      state.submitted = true;
    }),

    loadSignaturesAsync: create.asyncThunk(
      async (tab: SignatureStatus, { rejectWithValue }) => {
        try {
          return await fetchSignatures(tab);
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
          const payload = signatureListSerializer(action.payload);
          state.status = 'succeeded';
          state.list = payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The signature dishes didn't load.");
        },
      },
    ),

    reviewSignatureAsync: create.asyncThunk(
      async (input: { itemId: string; keep: boolean; note?: string; tab: SignatureStatus }, { rejectWithValue }) => {
        try {
          if (input.keep) await approveSignature(input.itemId);
          else await removeSignature(input.itemId, input.note ?? '');
          return await fetchSignatures(input.tab);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busy = action.meta.arg.itemId;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = signatureListSerializer(action.payload);
          state.busy = null;
          state.removing = null;
          state.list = payload;
        },
        rejected: (state, action) => {
          state.busy = null;
          state.actionError = readRejection(action, "That didn't go through.");
        },
      },
    ),
  }),
  selectors: {
    selectAdminKitchenSignatures: state => state,
  },
});

export const {
  setSignaturesTab,
  openRemoveNote,
  setRemoveNote,
  markRemoveSubmitted,
  loadSignaturesAsync,
  reviewSignatureAsync,
} = adminKitchenSignaturesSlice.actions;
export const { selectAdminKitchenSignatures } = adminKitchenSignaturesSlice.selectors;
