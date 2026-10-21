// MetroMatrix — My Kitchen: recipe ideas from the pantry, a recipe, and its
// missing items priced from Shopping's grocers.
// docs/API_KITCHEN_ASSUMED.md §2.15 (TODO(API_KITCHEN), TODO(API_AI): ideas are an assistant action).

import { api } from '../network/apiHelpers';
import { clean, request } from '../shopping/http';
import { homeRecipeSerializer, missingItemsSerializer, recipeIdeasSerializer } from '../../serializers/myKitchen/myKitchenSerializer';

const enc = encodeURIComponent;

export const suggestHomeRecipes = (q: { language: 'en' | 'ur'; maxMinutes?: number | null; servings?: number | null }) =>
  request(() => api.post('/my-kitchen/recipes/suggest', clean({ ...q })), recipeIdeasSerializer);

export const getHomeRecipe = (id: string, language: 'en' | 'ur', servings?: number | null) =>
  request(() => api.get(`/my-kitchen/recipes/${enc(id)}`, { params: clean({ language, servings }) }), homeRecipeSerializer);

export const getMissingItems = (id: string, servings?: number | null) =>
  request(() => api.get(`/my-kitchen/recipes/${enc(id)}/missing-items`, { params: clean({ servings }) }), missingItemsSerializer);
