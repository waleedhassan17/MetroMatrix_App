// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Recipes Network (docs/API_KITCHEN.md §3, §5, §23)
// ═══════════════════════════════════════════════════════
// Recipe cards per dish and size, what the stock can make, signature
// recipes, and the costing every dish and size is listed in.

import { API, toApiError } from '../network/network';
import type { RecipeInput } from '../../models/kitchen';
import { baseQty } from './stock';

const enc = encodeURIComponent;

/** A size's own card; without one (null or undefined), the dish's card every size shares. */
const sized = (variantId: string | null | undefined) => (variantId ? { variantId } : {});

/** The editor's card → the API's lines: base lines, add-on lines (their option) and packaging. */
const recipeBody = (input: RecipeInput) => ({
  yieldServings: input.yield,
  ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
  lines: [
    ...input.lines.map(l => ({ ingredientId: l.ingredientId, ...baseQty(l.qty, l.baseUnit) })),
    ...input.addOns.flatMap(a => a.lines.map(l => ({ ingredientId: l.ingredientId, ...baseQty(l.qty, l.baseUnit), optionId: a.optionId }))),
    ...input.packaging.map(l => ({ ingredientId: l.ingredientId, ...baseQty(l.qty, l.baseUnit), isPackaging: true })),
  ],
});

/** Every dish and size with its cost to make (the recipes list reads it). */
export const fetchCosting = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/costing' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The card, or null when the dish has none yet. */
export const fetchRecipe = async (itemId: string, variantId?: string | null): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendor/kitchen/items/${enc(itemId)}/recipe`, params: sized(variantId) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const saveRecipe = async (itemId: string, variantId: string | null, input: RecipeInput): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: `/food/vendor/kitchen/items/${enc(itemId)}/recipe`, data: recipeBody(input), params: sized(variantId) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteRecipe = async (itemId: string, variantId: string | null): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/food/vendor/kitchen/items/${enc(itemId)}/recipe`, params: sized(variantId) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** How many the stock on hand makes, per card, and what runs out first. */
export const fetchServings = async (itemId: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendor/kitchen/items/${enc(itemId)}/servings` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A signature recipe (it needs the card): whose it is, by default the kitchen's. */
export const setSignature = async (itemId: string, variantId: string | null, signature: { on: boolean; creatorName: string | null }): Promise<unknown> => {
  try {
    const data = { isSignature: signature.on, ...(signature.on && signature.creatorName?.trim() ? { by: signature.creatorName.trim() } : {}) };
    const response = await API.PUT({ URL: `/food/vendor/kitchen/items/${enc(itemId)}/signature`, data, params: sized(variantId) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
