// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Stock Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Stock, ingredients, stock takes.
// docs/API_KITCHEN_ASSUMED.md §4.1 (TODO(API_KITCHEN): an assumed contract).

import { API, toApiError, clean } from '../network/network';
import type { IngredientInput, StockSegment } from '../../models/kitchen';

const enc = encodeURIComponent;

export const fetchStock = async (segment: StockSegment, q: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/stock', params: clean({ segment, q: q.trim() }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchIngredient = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendor/kitchen/ingredients/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createIngredient = async (input: IngredientInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/kitchen/ingredients', data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateIngredient = async (id: string, patch: Partial<IngredientInput>): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/food/vendor/kitchen/ingredients/${enc(id)}`, data: patch });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteIngredient = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/food/vendor/kitchen/ingredients/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Counted amounts are base units (the form converts what the cook typed). */
export const recordStockTake = async (lines: { ingredientId: string; counted: number }[], note?: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/kitchen/stock-takes', data: clean({ lines, note }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
