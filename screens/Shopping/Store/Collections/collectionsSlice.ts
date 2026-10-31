// MetroMatrix — Collections slice: the store's own shelves (Luxe pret, Eid edit …).

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../../../store/createAppSlice';
import { createCollectionAPI, deleteCollectionAPI, getCollectionsAPI, renameCollectionAPI, reorderCollectionsAPI } from '../../../../networks/shopping/partner/productsNetwork';
import { toRejectedValue, required } from '../../../../networks/network/apiHelpers';
import type { Collection } from '../../../../types';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../../../Auth/shared/formStatus';
import { collectionListSerializer, collectionSerializer } from '../../../../serializers/shopping/catalogSerializer';

export interface CollectionsSliceState {
  collections: Collection[];
  status: FormStatus;
  busy: string | null;
  error: ServerError;
  /** The sheet: null closed, '' a new one, an id to rename. */
  editing: string | null;
  name: string;
}

const initialState: CollectionsSliceState = { collections: [], status: 'idle', busy: null, error: NO_ERROR, editing: null, name: '' };

export const collectionsSlice = createAppSlice({
  name: 'collections',
  initialState,
  reducers: create => ({
    openCollectionSheet: create.reducer((state, action: PayloadAction<{ id: string; name: string } | null>) => {
      state.editing = action.payload ? action.payload.id : '';
      state.name = action.payload?.name ?? '';
      state.error = NO_ERROR;
    }),
    closeCollectionSheet: create.reducer(state => {
      state.editing = null;
    }),
    setCollectionName: create.reducer((state, action: PayloadAction<string>) => {
      state.name = action.payload.slice(0, 40);
    }),
    loadCollectionsAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(collectionListSerializer(await getCollectionsAPI()));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.status = 'loading';
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.collections = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "We couldn't load your collections.");
        },
      },
    ),
    /** Create, rename, delete or reorder — each answers with the whole list. */
    changeCollectionsAsync: create.asyncThunk(
      async (
        change: { kind: 'save'; id: string; name: string } | { kind: 'delete'; id: string } | { kind: 'reorder'; ids: string[] },
        { rejectWithValue },
      ) => {
        try {
          if (change.kind === 'save') await (change.id ? renameCollectionAPI(change.id, change.name.trim()).then(raw => required(collectionSerializer(raw))) : createCollectionAPI(change.name.trim()).then(raw => required(collectionSerializer(raw))));
          else if (change.kind === 'delete') await deleteCollectionAPI(change.id);
          else return required(collectionListSerializer(await reorderCollectionsAPI(change.ids)));
          return required(collectionListSerializer(await getCollectionsAPI()));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.busy = action.meta.arg.kind;
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.busy = null;
          state.collections = action.payload;
          state.editing = null;
        },
        rejected: (state, action) => {
          state.busy = null;
          state.error = readRejection(action, "That didn't save. Try again.");
        },
      },
    ),
  }),
  selectors: {
    selectCollections: state => state,
  },
});

export const { openCollectionSheet, closeCollectionSheet, setCollectionName, loadCollectionsAsync, changeCollectionsAsync } = collectionsSlice.actions;
export const { selectCollections } = collectionsSlice.selectors;
