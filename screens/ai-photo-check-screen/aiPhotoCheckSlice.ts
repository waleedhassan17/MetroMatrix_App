// MetroMatrix — Kitchen assistant: photo check. A dish's photo (taken or
// picked, uploaded first) gets a score and tips; it can then become the
// dish's photo through the ordinary dish edit.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { checkPhoto } from '../../networks/kitchen/kitchenAi';
import { fetchMenuItems, updateMenuItem } from '../../networks/food/vendor/menu';
import { uploadImage } from '../../services/mediaUpload';
import { toRejectedValue, required } from '../../networks/network/network';
import type { LocalFile, PhotoCheck, VendorMenuItem } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { vendorMenuItemsSerializer, vendorMenuItemSerializer } from '../../serializers/food/menuSerializer';
import { photoCheckSerializer } from '../../serializers/kitchen/assistantSerializer';

export interface AiPhotoCheckSliceState {
  items: VendorMenuItem[];
  itemId: string | null;
  status: FormStatus;
  checking: boolean;
  result: PhotoCheck | null;
  error: ServerError;
  applying: boolean;
  applied: boolean;
}

const initialState: AiPhotoCheckSliceState = { items: [], itemId: null, status: 'idle', checking: false, result: null, error: NO_ERROR, applying: false, applied: false };

export const aiPhotoCheckSlice = createAppSlice({
  name: 'aiPhotoCheck',
  initialState,
  reducers: create => ({
    pickPhotoDish: create.reducer((state, action: PayloadAction<string | null>) => {
      state.itemId = action.payload;
      state.applied = false;
    }),
    loadPhotoDishesAsync: create.asyncThunk(
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
    checkPhotoAsync: create.asyncThunk(
      async ({ file, itemId }: { file: LocalFile; itemId: string | null }, { rejectWithValue }) => {
        try {
          const uploaded = await uploadImage(file, 'menu_item');
          return await checkPhoto(uploaded.url, itemId);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.checking = true;
          state.error = NO_ERROR;
          state.result = null;
          state.applied = false;
        },
        fulfilled: (state, action) => {
          const payload = photoCheckSerializer(action.payload);
          state.checking = false;
          state.result = payload;
        },
        rejected: (state, action) => {
          state.checking = false;
          state.error = readRejection(action, "The photo wasn't checked.");
        },
      },
    ),
    /** The ordinary dish edit. */
    applyPhotoAsync: create.asyncThunk(
      async ({ itemId, photoUrl }: { itemId: string; photoUrl: string }, { rejectWithValue }) => {
        try {
          return await updateMenuItem(itemId, { photoUrl });
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.applying = true;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          const payload = vendorMenuItemSerializer(action.payload);
          state.applying = false;
          state.applied = true;
          if (!payload) return;
          state.items = state.items.map(i => (i.id === payload.id ? payload : i));
        },
        rejected: (state, action) => {
          state.applying = false;
          state.error = readRejection(action, "The photo wasn't saved.");
        },
      },
    ),
  }),
  selectors: {
    selectAiPhotoCheck: state => state,
  },
});

export const { pickPhotoDish, loadPhotoDishesAsync, checkPhotoAsync, applyPhotoAsync } = aiPhotoCheckSlice.actions;
export const { selectAiPhotoCheck } = aiPhotoCheckSlice.selectors;
