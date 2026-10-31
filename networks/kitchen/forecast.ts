// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Forecast Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Expected dishes, the prep sheet and the shopping list.
// docs/API_KITCHEN_ASSUMED.md §4.3 (TODO(API_KITCHEN): an assumed contract).

import { API, toApiError } from '../network/network';

const enc = encodeURIComponent;

export const fetchForecast = async (date: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/forecast', params: { date } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The cook's own number for a dish (null: back to the forecast's). */
export const adjustForecast = async (date: string, itemId: string, adjusted: number | null): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: `/food/vendor/kitchen/forecast/${enc(date)}/items/${enc(itemId)}`, data: { adjusted } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchForecastAccuracy = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/forecast/accuracy' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchPrepSheet = async (date: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/prep-sheet', params: { date } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchShoppingList = async (date: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/shopping-list', params: { date } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
