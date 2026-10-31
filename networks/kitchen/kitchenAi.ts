// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Ai Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// The vendor's assistant (usage; drafts: the receipt
// scan, descriptions, today's specials, combo ideas, photo checks; the
// week's review themes). Every result is a draft: confirming goes through
// the ordinary menu and recipe routes.
// docs/AI_ASSUMED.md (TODO(API_AI): an assumed contract).

import { API, toApiError, clean } from '../network/network';

export const fetchAiUsage = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/ai/usage' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** After the receipt photo is uploaded (media purpose kitchen_receipt). A draft: nothing is saved. */
export const scanReceipt = async (imageUrl: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/ai/receipt-scan', data: { imageUrl } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** English and Urdu drafts for up to 10 dishes. */
export const draftDescriptions = async (itemIds: string[]): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/ai/descriptions', data: { itemIds } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Saving a description is the ordinary dish edit; `descriptionUr` is the assumed addition (TODO(API_KITCHEN)). */
export const saveDescription = async (itemId: string, input: { description: string | null; descriptionUr: string | null }): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/food/vendor/menu/items/${encodeURIComponent(itemId)}`, data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** From what expires soonest, or the ingredients given. */
export const suggestSpecials = async (ingredientIds?: string[]): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/ai/specials', data: clean({ ingredientIds: ingredientIds?.length ? ingredientIds : undefined }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const suggestCombos = async (): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/ai/combos' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** After the photo is uploaded (media purpose menu_item). */
export const checkPhoto = async (imageUrl: string, itemId?: string | null): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/food/vendor/ai/photo-check', data: clean({ imageUrl, itemId }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** A Monday; without one, the latest week with a review. Counted once a week. */
export const fetchReviewInsights = async (week?: string | null): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/reviews/insights', params: clean({ week }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
