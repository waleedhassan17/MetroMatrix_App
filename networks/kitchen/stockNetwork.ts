// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Stock Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Stock, ingredients, stock takes.
// docs/API_KITCHEN_ASSUMED.md §4.1 (TODO(API_KITCHEN): an assumed contract).

import { api, toApiError, clean } from '../network/apiHelpers';
import type { IngredientInput, StockSegment } from '../../types/kitchen';

const enc = encodeURIComponent;

export const getStockAPI = async (segment: StockSegment, q: string): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/kitchen/stock', { params: clean({ segment, q: q.trim() }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getIngredientAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.get(`/food/vendor/kitchen/ingredients/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createIngredientAPI = async (input: IngredientInput): Promise<unknown> => {
  try {
    const response = await api.post('/food/vendor/kitchen/ingredients', input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateIngredientAPI = async (id: string, patch: Partial<IngredientInput>): Promise<unknown> => {
  try {
    const response = await api.patch(`/food/vendor/kitchen/ingredients/${enc(id)}`, patch);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteIngredientAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/food/vendor/kitchen/ingredients/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Counted amounts are base units (the form converts what the cook typed). */
export const recordStockTakeAPI = async (lines: { ingredientId: string; counted: number }[], note?: string): Promise<unknown> => {
  try {
    const response = await api.post('/food/vendor/kitchen/stock-takes', clean({ lines, note }));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
