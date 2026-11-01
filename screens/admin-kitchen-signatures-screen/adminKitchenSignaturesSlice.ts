// ═══════════════════════════════════════════════════════
// MetroMatrix — Admin Kitchen: signature dishes slice
// ═══════════════════════════════════════════════════════
// Dishes kitchens mark as their signature: new ones to look at, kept ones,
// and ones staff took the label off with a note the kitchen sees.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchSignatures, removeSignature } from '../../networks/admin/adminKitchen';
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
  removing: Pick<SignatureDish, 'recipeCardId' | 'name'> | null;
  note: string;
  submitted: boolean;
  busy: string | null;
  actionError: ServerError;
}

const initialState: AdminKitchenSignaturesSliceState = {
  tab: 'claimed',
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
    openRemoveNote: create.reducer((state, action: PayloadAction<Pick<SignatureDish, 'recipeCardId' | 'name'> | null>) => {
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
      async (_tab: SignatureStatus, { rejectWithValue }) => {
        try {
          // Both lists, for the tabs' counts.
          const [claimed, removed] = await Promise.all([fetchSignatures('claimed'), fetchSignatures('removed')]);
          return { claimed, removed };
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
          state.list = signatureListSerializer(action.payload, action.meta.arg);
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "The signature dishes didn't load.");
        },
      },
    ),

    reviewSignatureAsync: create.asyncThunk(
      /** A claim is live on its own; staff take one down with a reason the kitchen is told. */
      async (input: { recipeCardId: string; note: string; tab: SignatureStatus }, { rejectWithValue }) => {
        try {
          await removeSignature(input.recipeCardId, input.note);
          const [claimed, removed] = await Promise.all([fetchSignatures('claimed'), fetchSignatures('removed')]);
          return { claimed, removed };
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busy = action.meta.arg.recipeCardId;
          state.actionError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = null;
          state.removing = null;
          state.list = signatureListSerializer(action.payload, action.meta.arg.tab);
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
