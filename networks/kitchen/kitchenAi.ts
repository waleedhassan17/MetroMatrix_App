// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Assistant Network (docs/API_KITCHEN.md §4, §31–32; docs/AI.md)
// ═══════════════════════════════════════════════════════
// The AI meter, the receipt scan, the menu assistant (descriptions, specials,
// combos, the photo check) and review insights. Every answer is a draft;
// nothing is saved until the cook confirms through the ordinary route.
// AI_UNAVAILABLE and AI_QUOTA_REACHED carry the manual path (aiModel).

import { API, toApiError, clean } from '../network/network';

const enc = encodeURIComponent;
const A = '/food/vendor/kitchen/ai';

/** This month's smart actions and voice minutes, and which voice screens are on. */
export const fetchAiUsage = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/ai/usage' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A bill photo (a private `receipt` upload) → a draft purchase; nothing is saved. */
export const scanReceipt = async (imageUrl: string, publicId?: string | null): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/kitchen/purchases/scan', data: clean({ imageUrl, publicId }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** English and Urdu drafts for one dish; `save` is the PATCH that keeps them. */
export const draftDescription = async (itemId: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${A}/describe`, data: { itemId } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The ordinary dish PATCH: what the cook confirmed. */
export const saveDescription = async (itemId: string, input: { description: string | null; descriptionUr: string | null }): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/food/vendor/menu/items/${enc(itemId)}`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Specials from what expires within 3 days (only these ingredients, when given). */
export const suggestSpecials = async (ingredientIds?: string[]): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${A}/specials`, data: ingredientIds?.length ? { ingredientIds } : {} });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** An idea the cook kept → an inactive dish with that recipe card. */
export const createSpecial = async (input: {
  name: string;
  description?: string | null;
  basePrice: number;
  categoryId?: string | null;
  servings: number;
  lines: { ingredientId: string; qty: number; unit: string }[];
}): Promise<unknown> => {
  try {
    const data = clean({ name: input.name.trim(), description: input.description?.trim(), basePrice: input.basePrice, categoryId: input.categoryId, servings: input.servings, lines: input.lines });
    const response = await API.POST({ URL: `${A}/specials/create`, data });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Dishes ordered together; a `draft` deal body for each (nothing is created). */
export const suggestCombos = async (): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${A}/combos` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A menu photo measured (light, sharpness, framing), with tips. */
export const checkPhoto = async (imageUrl: string, itemId?: string | null): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `${A}/photo-check`, data: clean({ imageUrl, itemId }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The latest themes from the reviews, and the 7 runs before. */
export const fetchReviewInsights = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/review-insights' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
