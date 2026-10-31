// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Favourites Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// The customer's saved kitchens.
// docs/API_FOOD.md §4.2: GET /food/favourites, POST/DELETE /food/favourites/:vendorId.

import { API, toApiError } from '../network/network';

const enc = encodeURIComponent;
export const fetchFavourites = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/favourites' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const addFavourite = async (vendorId: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/favourites/${enc(vendorId)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
export const removeFavourite = async (vendorId: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/food/favourites/${enc(vendorId)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
