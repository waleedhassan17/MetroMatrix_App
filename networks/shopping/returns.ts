// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Returns Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { API, toApiError, pageParams } from '../network/network';
import type { ReturnInput } from '../../models/shopping';

export const requestReturn = async (orderId: string, input: ReturnInput): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/shop/orders/${encodeURIComponent(orderId)}/returns`, data: input });
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
