// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Favourites Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// The customer's saved kitchens.
// docs/API_FOOD.md §4.2: GET /food/favourites, POST/DELETE /food/favourites/:vendorId.

import { api, toApiError } from '../network/apiHelpers';

const enc = encodeURIComponent;
export const getFavouritesAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/favourites');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const addFavouriteAPI = async (vendorId: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/favourites/${enc(vendorId)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const removeFavouriteAPI = async (vendorId: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/food/favourites/${enc(vendorId)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
