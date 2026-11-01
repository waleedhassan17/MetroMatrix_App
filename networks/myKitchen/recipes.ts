// ═══════════════════════════════════════════════════════
// MetroMatrix — Home Recipes Network (docs/API_KITCHEN.md §35)
// ═══════════════════════════════════════════════════════
// Recipes from the pantry (what expires first leads; AI or the recipe book),
// each whole in the answer, and Shopping's grocery options for what is
// missing. Nothing is added to the bag for the person.

import { API, toApiError, clean } from '../network/network';

export const suggestHomeRecipes = async (): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/my-kitchen/recipes/suggest' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Grocery products for each missing item, cheapest per kg / l / piece first. */
export const fetchMissingItems = async (names: string[], city?: string | null): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/my-kitchen/missing-to-bag', data: clean({ items: names.map(name => ({ name })), city }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
