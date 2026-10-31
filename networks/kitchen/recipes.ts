// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Recipes Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Recipe cards per dish and size.
// docs/API_KITCHEN_ASSUMED.md §4.2 (TODO(API_KITCHEN): an assumed contract).

import { API, toApiError } from '../network/network';
import type { RecipeInput } from '../../models/kitchen';

const enc = encodeURIComponent;
const sized = (variantId: string | null | undefined) => (variantId === undefined ? {} : { variantId: variantId ?? 'null' });

export const fetchRecipes = async (needsRecipe: boolean): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/recipes', params: needsRecipe ? { needs: 'recipe' } : {} });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** undefined: the dish's default size; null: the recipe every size shares. */
export const fetchRecipe = async (itemId: string, variantId?: string | null): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/food/vendor/kitchen/recipes/${enc(itemId)}`, params: sized(variantId) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const saveRecipe = async (itemId: string, variantId: string | null, input: RecipeInput): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: `/food/vendor/kitchen/recipes/${enc(itemId)}`, data: input, params: sized(variantId) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const deleteRecipe = async (itemId: string, variantId: string | null): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/food/vendor/kitchen/recipes/${enc(itemId)}`, params: sized(variantId) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
