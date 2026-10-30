// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Forecast Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Expected dishes, the prep sheet and the shopping list.
// docs/API_KITCHEN_ASSUMED.md §4.3 (TODO(API_KITCHEN): an assumed contract).

import { api, toApiError } from '../network/apiHelpers';

const enc = encodeURIComponent;

export const getForecastAPI = async (date: string): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/kitchen/forecast', { params: { date } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The cook's own number for a dish (null: back to the forecast's). */
export const adjustForecastAPI = async (date: string, itemId: string, adjusted: number | null): Promise<unknown> => {
  try {
    const response = await api.put(`/food/vendor/kitchen/forecast/${enc(date)}/items/${enc(itemId)}`, { adjusted });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getForecastAccuracyAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/kitchen/forecast/accuracy');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getPrepSheetAPI = async (date: string): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/kitchen/prep-sheet', { params: { date } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getShoppingListAPI = async (date: string): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/kitchen/shopping-list', { params: { date } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
