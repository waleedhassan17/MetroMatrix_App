// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Court: saved kitchens
// ═══════════════════════════════════════════════════════
// The kitchens the customer saved, newest first. The heart on a vendor's
// page reads and flips it (at once, then the server's answer; undone if
// the server says no).

import { createAppSlice } from '../../store/createAppSlice';
import { addFavouriteAPI, getFavouritesAPI, removeFavouriteAPI } from '../../networks/food/favouritesNetwork';
import { toRejectedValue, required } from '../../networks/network/apiHelpers';
import type { FoodFavourite } from '../../models';
import { NO_ERROR, readRejection, type FormStatus, type ServerError } from '../shared/formStatus';
import { foodFavouritesSerializer, favouritedSerializer, unfavouritedSerializer } from '../../serializers/food/favouriteSerializer';

export interface FoodFavouritesSliceState {
  items: FoodFavourite[];
  /** Kitchens saved on this device before the list came back (or not yet listed). */
  savedIds: string[];
  status: FormStatus;
  error: ServerError;
}

const initialState: FoodFavouritesSliceState = { items: [], savedIds: [], status: 'idle', error: NO_ERROR };

export const foodFavouritesSlice = createAppSlice({
  name: 'foodFavourites',
  initialState,
  reducers: create => ({
    loadFavouritesAsync: create.asyncThunk(
      async (_: void, { rejectWithValue }) => {
        try {
          return required(foodFavouritesSerializer(await getFavouritesAPI()));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: state => {
          if (state.status !== 'succeeded') state.status = 'loading';
          state.error = NO_ERROR;
        },
        fulfilled: (state, action) => {
          state.status = 'succeeded';
          state.items = action.payload;
          state.savedIds = action.payload.map(f => f.id);
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = readRejection(action, "Your saved kitchens didn't load.");
        },
      },
    ),

    toggleFavouriteAsync: create.asyncThunk(
      async ({ vendorId, save }: { vendorId: string; save: boolean }, { rejectWithValue }) => {
        try {
          return save ? required(favouritedSerializer(await addFavouriteAPI(vendorId))) : required(unfavouritedSerializer(await removeFavouriteAPI(vendorId)));
        } catch (e) {
          return rejectWithValue(toRejectedValue(e));
        }
      },
      {
        pending: (state, action) => {
          const { vendorId, save } = action.meta.arg;
          state.savedIds = save ? [...new Set([...state.savedIds, vendorId])] : state.savedIds.filter(id => id !== vendorId);
          if (!save) state.items = state.items.filter(f => f.id !== vendorId);
        },
        rejected: (state, action) => {
          const { vendorId, save } = action.meta.arg;
          state.savedIds = save ? state.savedIds.filter(id => id !== vendorId) : [...state.savedIds, vendorId];
          state.error = readRejection(action, "That didn't save.");
        },
      },
    ),
  }),
  selectors: {
    selectFoodFavourites: state => state,
    selectIsFavourite: (state, vendorId: string) => state.savedIds.includes(vendorId),
  },
});

export const { loadFavouritesAsync, toggleFavouriteAsync } = foodFavouritesSlice.actions;
export const { selectFoodFavourites, selectIsFavourite } = foodFavouritesSlice.selectors;
