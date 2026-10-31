// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Reviews Network (API_SHOPPING.md §5.3)
// ═══════════════════════════════════════════════════════

import { API, toApiError } from '../network/network';
import type { ReviewInput } from '../../models/shopping';

/** The API keeps no title, so one goes at the top of the text. */
const reviewBody = (input: ReviewInput) => {
  const text = [input.title?.trim(), input.body.trim()].filter(Boolean).join('\n\n');
  return { rating: input.rating, ...(text ? { text } : null), ...(input.photos.length ? { photos: input.photos } : null) };
};

/** One review per delivered order line: `{ rating 1–5, text?, photos? }`. */
export const writeReview = async (itemId: string, input: ReviewInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/shop/order-items/${encodeURIComponent(itemId)}/review`, data: reviewBody(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
