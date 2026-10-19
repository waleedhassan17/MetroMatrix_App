// MetroMatrix — Kitchen: expected dishes, the prep sheet and the shopping list.
// docs/API_KITCHEN_ASSUMED.md §4.3 (TODO(API_KITCHEN): an assumed contract).

import { api } from '../network/apiHelpers';
import { request } from '../shopping/http';
import { accuracySerializer, forecastItemSerializer, forecastSerializer, prepSheetSerializer, shoppingListSerializer } from '../../serializers/kitchen/forecastSerializer';

const enc = encodeURIComponent;

export const getForecast = (date: string) => request(() => api.get('/food/vendor/kitchen/forecast', { params: { date } }), forecastSerializer);

/** The cook's own number for a dish (null: back to the forecast's). */
export const adjustForecast = (date: string, itemId: string, adjusted: number | null) =>
  request(() => api.put(`/food/vendor/kitchen/forecast/${enc(date)}/items/${enc(itemId)}`, { adjusted }), forecastItemSerializer);

export const getForecastAccuracy = () => request(() => api.get('/food/vendor/kitchen/forecast/accuracy'), accuracySerializer);

export const getPrepSheet = (date: string) => request(() => api.get('/food/vendor/kitchen/prep-sheet', { params: { date } }), prepSheetSerializer);

export const getShoppingList = (date: string) => request(() => api.get('/food/vendor/kitchen/shopping-list', { params: { date } }), shoppingListSerializer);
