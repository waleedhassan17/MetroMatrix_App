// ═══════════════════════════════════════════════════════
// MetroMatrix — My Kitchen Recipes Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Recipe ideas from the pantry, a recipe, and its
// missing items priced from Shopping's grocers.
// docs/API_KITCHEN_ASSUMED.md §2.15 (TODO(API_KITCHEN), TODO(API_AI): ideas are an assistant action).

import { API, toApiError, clean } from '../network/network';

const enc = encodeURIComponent;

export const suggestHomeRecipes = async (q: { language: 'en' | 'ur'; maxMinutes?: number | null; servings?: number | null }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/my-kitchen/recipes/suggest', data: clean({ ...q }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchHomeRecipe = async (id: string, language: 'en' | 'ur', servings?: number | null): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/my-kitchen/recipes/${enc(id)}`, params: clean({ language, servings }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchMissingItems = async (id: string, servings?: number | null): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/my-kitchen/recipes/${enc(id)}/missing-items`, params: clean({ servings }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
