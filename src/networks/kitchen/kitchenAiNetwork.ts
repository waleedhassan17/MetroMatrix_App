// MetroMatrix — Kitchen: the vendor's assistant (usage; drafts: the receipt
// scan, descriptions, today's specials, combo ideas, photo checks; the
// week's review themes). Every result is a draft: confirming goes through
// the ordinary menu and recipe routes.
// docs/AI_ASSUMED.md (TODO(API_AI): an assumed contract).

import { api } from '../network/apiHelpers';
import { clean, request } from '../shopping/http';
import { aiUsageSerializer, receiptDraftSerializer } from '../../serializers/kitchen/insightSerializer';
import { comboIdeasSerializer, descriptionDraftsSerializer, photoCheckSerializer, reviewInsightsSerializer, specialIdeasSerializer } from '../../serializers/kitchen/assistantSerializer';
import { vendorMenuItemSerializer } from '../../serializers/food/menuSerializer';

export const getAiUsage = () => request(() => api.get('/food/vendor/ai/usage'), aiUsageSerializer);

/** After the receipt photo is uploaded (media purpose kitchen_receipt). A draft: nothing is saved. */
export const scanReceipt = (imageUrl: string) => request(() => api.post('/food/vendor/ai/receipt-scan', { imageUrl }), receiptDraftSerializer);

/** English and Urdu drafts for up to 10 dishes. */
export const draftDescriptions = (itemIds: string[]) => request(() => api.post('/food/vendor/ai/descriptions', { itemIds }), descriptionDraftsSerializer);

/** Saving a description is the ordinary dish edit; `descriptionUr` is the assumed addition (TODO(API_KITCHEN)). */
export const saveDescription = (itemId: string, input: { description: string | null; descriptionUr: string | null }) =>
  request(() => api.patch(`/food/vendor/menu/items/${encodeURIComponent(itemId)}`, input), vendorMenuItemSerializer);

/** From what expires soonest, or the ingredients given. */
export const suggestSpecials = (ingredientIds?: string[]) => request(() => api.post('/food/vendor/ai/specials', clean({ ingredientIds: ingredientIds?.length ? ingredientIds : undefined })), specialIdeasSerializer);

export const suggestCombos = () => request(() => api.post('/food/vendor/ai/combos'), comboIdeasSerializer);

/** After the photo is uploaded (media purpose menu_item). */
export const checkPhoto = (imageUrl: string, itemId?: string | null) => request(() => api.post('/food/vendor/ai/photo-check', clean({ imageUrl, itemId })), photoCheckSerializer);

/** A Monday; without one, the latest week with a review. Counted once a week. */
export const getReviewInsights = (week?: string | null) => request(() => api.get('/food/vendor/reviews/insights', { params: clean({ week }) }), reviewInsightsSerializer);
