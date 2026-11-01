// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Stock Network (docs/API_KITCHEN.md §1–2)
// ═══════════════════════════════════════════════════════
// Ingredients, stock, stock takes, an ingredient's batches and ledger.
// Quantities go out in base units (the app converts what the cook typed);
// the API names the piece `piece`.

import { API, toApiError, clean, pageParams } from '../network/network';
import type { IngredientInput, StockSegment } from '../../models/kitchen';
import type { BaseUnit } from '../../utils/units/units';

const enc = encodeURIComponent;

/** The app's stock segments are the API's filters. */
const FILTER: Record<StockSegment, string> = { all: 'all', low: 'below_par', expiring: 'expiring', negative: 'negative' };

export const apiUnit = (b: BaseUnit): string => (b === 'pc' ? 'piece' : b);

/** A base-unit amount as the API takes it. */
export const baseQty = (qty: number, b: BaseUnit) => ({ qty, unit: apiUnit(b) });

/** The ingredient form → the API's body (the reference price and nutrition food are their own calls). */
const ingredientBody = (input: Partial<IngredientInput>, unit: BaseUnit) => ({
  ...clean({
    name: input.name?.trim(),
    nameUr: input.nameUr?.trim(),
    category: input.category,
    baseUnit: input.baseUnit ? apiUnit(input.baseUnit) : undefined,
  }),
  ...(input.customUnits ? { customUnits: input.customUnits.map(c => ({ name: c.name.trim().toLowerCase(), factor: c.base })) } : {}),
  ...(input.parLevel === undefined ? {} : { parLevel: input.parLevel === null ? null : baseQty(input.parLevel, unit) }),
  ...(input.openingStock
    ? { openingStock: clean({ ...baseQty(input.openingStock.qty, unit), totalCost: input.openingStock.totalCost, expiresOn: input.openingStock.expiresOn }) }
    : {}),
});

export const fetchStock = async (segment: StockSegment, q: string, page = 1, pageSize = 100): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/stock', params: clean({ filter: FILTER[segment], q: q.trim(), ...pageParams(page, pageSize) }) });
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

/** What FIFO uses next, oldest first. */
export const fetchIngredientBatches = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendor/kitchen/stock/${enc(id)}/batches` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The ledger, newest first. */
export const fetchIngredientMovements = async (id: string, page = 1, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendor/kitchen/stock/${enc(id)}/movements`, params: pageParams(page, pageSize) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const createIngredient = async (input: IngredientInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/kitchen/ingredients', data: ingredientBody(input, input.baseUnit) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** `unit` is the ingredient's base unit, for the par level. */
export const updateIngredient = async (id: string, patch: Partial<IngredientInput>, unit: BaseUnit): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/food/vendor/kitchen/ingredients/${enc(id)}`, data: ingredientBody(patch, unit) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A delete when nothing refers to it, else `{ deactivated: true }`. */
export const deleteIngredient = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/food/vendor/kitchen/ingredients/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The PBS city price this ingredient is compared with (same base unit), or none. */
export const setIngredientReference = async (id: string, referenceItemId: string | null): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/food/vendor/kitchen/ingredients/${enc(id)}/reference`, data: { referenceItemId } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Each line sets on-hand to what was counted (base units). */
export const recordStockTake = async (lines: { ingredientId: string; counted: number; baseUnit: BaseUnit }[], note?: string): Promise<unknown> => {
  try {
    const data = clean({ lines: lines.map(l => ({ ingredientId: l.ingredientId, ...baseQty(l.counted, l.baseUnit) })), note: note?.trim() });
    const response = await API.POST({ URL: '/food/vendor/kitchen/stock/count', data });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
