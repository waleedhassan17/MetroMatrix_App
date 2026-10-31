// MetroMatrix — Kitchen assistant: dish descriptions. Pick dishes, get English
// and Urdu drafts, edit them, save each one through the ordinary dish edit.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { fetchMenuItems } from '../../networks/food/vendor/menu';
import { draftDescriptions, saveDescription } from '../../networks/kitchen/kitchenAi';
import { toRejectedValue } from '../../networks/network/network';
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
          return await fetchMenuItems();
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
          const payload = vendorMenuItemsSerializer(action.payload);
          state.status = 'succeeded';
          state.items = payload;
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
          return await draftDescriptions(itemIds);
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
          const payload = descriptionDraftsSerializer(action.payload);
          state.drafting = false;
          state.drafts = payload;
          state.edits = Object.fromEntries(payload.map(d => [d.itemId, { en: d.en, ur: d.ur }]));
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
          return await saveDescription(itemId, descriptionInput({ en, ur }));
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
          const payload = vendorMenuItemSerializer(action.payload);
          state.saving = null;
          state.saved.push(action.meta.arg.itemId);
          const d = state.drafts.find(x => x.itemId === action.meta.arg.itemId);
          if (!payload) return;
          if (d) d.current = { en: payload.description, ur: descriptionInput(action.meta.arg).descriptionUr };
          state.items = state.items.map(i => (i.id === payload.id ? payload : i));
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
