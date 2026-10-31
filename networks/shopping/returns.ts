// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Returns Network (API_SHOPPING.md §5.3)
// ═══════════════════════════════════════════════════════

import { API, toApiError, pageParams } from '../network/network';
import type { ReturnInput } from '../../models/shopping';

const returnBody = (input: ReturnInput) => ({
  items: input.items,
  reason: input.reason,
  ...(input.details.trim() ? { details: input.details.trim() } : null),
  ...(input.photos.length ? { photos: input.photos } : null),
});

/**
 * A delivered store order, inside its return window, with no other open
 * return: `{ items: [{ orderItemId, quantity }], reason, details?, photos? }`.
 */
export const requestReturn = async (orderId: string, input: ReturnInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/shop/store-orders/${encodeURIComponent(orderId)}/returns`, data: returnBody(input) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchReturns = async (page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/shop/returns', params: pageParams(page, pageSize) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchReturn = async (id: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: `/shop/returns/${encodeURIComponent(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
