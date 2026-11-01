// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Forecast Network (docs/API_KITCHEN.md §8)
// ═══════════════════════════════════════════════════════
// Expected dishes (with how accurate the forecast has been), the prep sheet,
// the shopping list, a home kitchen's portions, the smart ETA's record.

import { API, toApiError, clean } from '../network/network';

const enc = encodeURIComponent;

/** `days` from `from` (at most 14); the answer carries the accuracy too. */
export const fetchForecast = async (from: string, days = 1): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/forecast', params: { from, days } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The cook's own number for one forecast row (null: back to the forecast's). */
export const adjustForecast = async (forecastId: string, adjusted: number | null): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/food/vendor/kitchen/forecast/${enc(forecastId)}`, data: { adjusted } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Default tomorrow. */
export const fetchPrepSheet = async (date?: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/prep-sheet', params: clean({ date }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchShoppingList = async (date?: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/shopping-list', params: clean({ date }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Home kitchens: how many to cook, from the forecast and the stock. */
export const fetchPortionSuggestions = async (date?: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/portions/suggestions', params: clean({ date }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Today resets what is left; tomorrow sets the daily limit the nightly reset uses. */
export const applyPortionSuggestion = async (date: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/kitchen/portions/apply-suggestion', data: { date } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** How often orders were ready on time, and what the kitchen has learned per hour. */
export const fetchEtaAccuracy = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/eta-accuracy' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
