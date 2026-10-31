// MetroMatrix — Kitchen: one ingredient (its batches, movements and the
// dishes that use it), and deleting it.

import { createAppSlice } from '../../store/createAppSlice';
import { deleteIngredientAPI, getIngredientAPI } from '../../networks/kitchen/stockNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import type { IngredientDetail } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { ingredientDetailSerializer } from '../../serializers/kitchen/stockSerializer';

export interface IngredientSliceState {
  detail: IngredientDetail | null;
  status: FormStatus;
  error: ServerError;
  deleting: boolean;
  deleteError: ServerError;
}

const initialState: IngredientSliceState = { detail: null, status: 'idle', error: NO_ERROR, deleting: false, deleteError: NO_ERROR };

export const ingredientSlice = createAppSlice({
  name: 'ingredient',
  initialState,
  reducers: create => ({
    loadIngredientAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return required(ingredientDetailSerializer(await getIngredientAPI(id)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          state.status = 'loading';
          state.error = NO_ERROR;
          state.deleteError = NO_ERROR;
          if (state.detail?.id !== action.meta.arg) state.detail = null;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.detail = action.payload;
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "This ingredient didn't load.");
        },
      },
    ),
    deleteIngredientAsync: create.asyncThunk(
      async (id: string, { rejectWithValue }) => {
        try {
          return await deleteIngredientAPI(id);
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          state.deleting = true;
          state.deleteError = NO_ERROR;
        },
        fulfilled: state => {
          state.deleting = false;
          state.detail = null;
        },
        rejected: (state, action) => {
          state.deleting = false;
          state.deleteError = readRejection(action, "It wasn't deleted.");
        },
      },
    ),
  }),
  selectors: {
    selectIngredient: state => state,
  },
});

export const { loadIngredientAsync, deleteIngredientAsync } = ingredientSlice.actions;
export const { selectIngredient } = ingredientSlice.selectors;
