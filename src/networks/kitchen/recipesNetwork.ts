// MetroMatrix — Kitchen: recipe cards per dish and size.
// docs/API_KITCHEN_ASSUMED.md §4.2 (TODO(API_KITCHEN): an assumed contract).

import { api } from '../network/apiHelpers';
import { request } from '../shopping/http';
import { recipeListSerializer, recipeSerializer } from '../../serializers/kitchen/recipeSerializer';
import type { RecipeInput } from '../../types/kitchen';

const enc = encodeURIComponent;
const sized = (variantId: string | null | undefined) => (variantId === undefined ? {} : { variantId: variantId ?? 'null' });

export const listRecipes = (needsRecipe: boolean) =>
  request(() => api.get('/food/vendor/kitchen/recipes', { params: needsRecipe ? { needs: 'recipe' } : {} }), recipeListSerializer);

/** undefined: the dish's default size; null: the recipe every size shares. */
export const getRecipe = (itemId: string, variantId?: string | null) =>
  request(() => api.get(`/food/vendor/kitchen/recipes/${enc(itemId)}`, { params: sized(variantId) }), recipeSerializer);

export const saveRecipe = (itemId: string, variantId: string | null, input: RecipeInput) =>
  request(() => api.put(`/food/vendor/kitchen/recipes/${enc(itemId)}`, input, { params: sized(variantId) }), recipeSerializer);

export const deleteRecipe = (itemId: string, variantId: string | null) =>
  request(() => api.delete(`/food/vendor/kitchen/recipes/${enc(itemId)}`, { params: sized(variantId) }), recipeSerializer);
