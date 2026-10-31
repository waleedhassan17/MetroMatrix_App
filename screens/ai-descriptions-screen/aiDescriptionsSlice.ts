// MetroMatrix — Kitchen assistant: dish descriptions. Pick dishes, get English
// and Urdu drafts, edit them, save each one through the ordinary dish edit.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { getMenuItemsAPI } from '../../networks/food/vendor/menuNetwork';
import { draftDescriptionsAPI, saveDescriptionAPI } from '../../networks/kitchen/kitchenAiNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import { MAX_DESCRIPTION_DISHES, descriptionInput } from '../../models/kitchen/assistantModel';
import type { DescriptionDraft, VendorMenuItem } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { vendorMenuItemsSerializer, vendorMenuItemSerializer } from '../../serializers/food/menuSerializer';
import { descriptionDraftsSerializer } from '../../serializers/kitchen/assistantSerializer';

export interface AiDescriptionsSliceState {
  items: VendorMenuItem[];
  status: FormStatus;
  error: ServerError;
  selected: string[];
  drafts: DescriptionDraft[];
  /** The cook's edits, by dish. */
  edits: Record<string, { en: string; ur: string }>;
  drafting: boolean;
  draftError: ServerError;
  saving: string | null;
  saved: string[];
  saveError: ServerError;
}

const initialState: AiDescriptionsSliceState = {
  items: [],
  status: 'idle',
  error: NO_ERROR,
  selected: [],
  drafts: [],
  edits: {},
  drafting: false,
  draftError: NO_ERROR,
  saving: null,
  saved: [],
  saveError: NO_ERROR,
};

export const aiDescriptionsSlice = createAppSlice({
  name: 'aiDescriptions',
  initialState,
  reducers: create => ({
    toggleDescribe: create.reducer((state, action: PayloadAction<string>) => {
      const id = action.payload;
      if (state.selected.includes(id)) state.selected = state.selected.filter(x => x !== id);
      else if (state.selected.length < MAX_DESCRIPTION_DISHES) state.selected.push(id);
    }),
    setDraftText: create.reducer((state, action: PayloadAction<{ itemId: string; field: 'en' | 'ur'; value: string }>) => {
      const e = state.edits[action.payload.itemId];
      if (e) e[action.payload.field] = action.payload.value;
      state.saved = state.saved.filter(x => x !== action.payload.itemId);
    }),
    startOver: create.reducer(state => {
      state.drafts = [];
      state.edits = {};
      state.saved = [];
      state.draftError = NO_ERROR;
      state.saveError = NO_ERROR;
    }),
    loadDescribeItemsAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(vendorMenuItemsSerializer(await getMenuItemsAPI()));
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
          state.items = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your dishes didn't load.");
        },
      },
    ),
    draftDescriptionsAsync: create.asyncThunk(
      async (itemIds: string[], { rejectWithValue }) => {
        try {
          return required(descriptionDraftsSerializer(await draftDescriptionsAPI(itemIds)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.drafting = true;
          state.draftError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.drafting = false;
          state.drafts = action.payload;
          state.edits = Object.fromEntries(action.payload.map(d => [d.itemId, { en: d.en, ur: d.ur }]));
          state.saved = [];
        },
        rejected: (state, action) => {
          state.drafting = false;
          state.draftError = readRejection(action, "The drafts didn't come.");
        },
      },
    ),
    saveDescriptionAsync: create.asyncThunk(
      async ({ itemId, en, ur }: { itemId: string; en: string; ur: string }, { rejectWithValue }) => {
        try {
          return required(vendorMenuItemSerializer(await saveDescriptionAPI(itemId, descriptionInput({ en, ur }))));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.saving = action.meta.arg.itemId;
          state.saveError = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.saving = null;
          state.saved.push(action.meta.arg.itemId);
          const d = state.drafts.find(x => x.itemId === action.meta.arg.itemId);
          if (d) d.current = { en: action.payload.description, ur: descriptionInput(action.meta.arg).descriptionUr };
          state.items = state.items.map(i => (i.id === action.payload.id ? action.payload : i));
        },
        rejected: (state, action) => {
          state.saving = null;
          state.saveError = readRejection(action, "That didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectAiDescriptions: state => state,
  },
});

export const { toggleDescribe, setDraftText, startOver, loadDescribeItemsAsync, draftDescriptionsAsync, saveDescriptionAsync } = aiDescriptionsSlice.actions;
export const { selectAiDescriptions } = aiDescriptionsSlice.selectors;
