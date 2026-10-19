// MetroMatrix — Kitchen: stock, ingredients, stock takes.
// docs/API_KITCHEN_ASSUMED.md §4.1 (TODO(API_KITCHEN): an assumed contract).

import { api } from '../network/apiHelpers';
import { clean, request } from '../shopping/http';
import { ingredientDetailSerializer, stockListSerializer, stockTakeSerializer } from '../../serializers/kitchen/stockSerializer';
import type { IngredientInput, StockSegment } from '../../types/kitchen';

const enc = encodeURIComponent;

export const listStock = (segment: StockSegment, q: string) =>
  request(() => api.get('/food/vendor/kitchen/stock', { params: clean({ segment, q: q.trim() }) }), stockListSerializer);

export const getIngredient = (id: string) => request(() => api.get(`/food/vendor/kitchen/ingredients/${enc(id)}`), ingredientDetailSerializer);

export const createIngredient = (input: IngredientInput) => request(() => api.post('/food/vendor/kitchen/ingredients', input), ingredientDetailSerializer);

export const updateIngredient = (id: string, patch: Partial<IngredientInput>) =>
  request(() => api.patch(`/food/vendor/kitchen/ingredients/${enc(id)}`, patch), ingredientDetailSerializer);

export const deleteIngredient = (id: string) => request(() => api.delete(`/food/vendor/kitchen/ingredients/${enc(id)}`), () => true as const);

/** Counted amounts are base units (the form converts what the cook typed). */
export const recordStockTake = (lines: { ingredientId: string; counted: number }[], note?: string) =>
  request(() => api.post('/food/vendor/kitchen/stock-takes', clean({ lines, note })), stockTakeSerializer);
