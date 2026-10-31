// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping Returns Network (API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// TODO(API_SHOPPING): paths and shapes from docs/API_SHOPPING_ASSUMED.md.

import { api, toApiError, pageParams } from '../network/apiHelpers';
import type { ReturnInput } from '../../types/shopping';

export const requestReturnAPI = async (orderId: string, input: ReturnInput): Promise<unknown> => {
  try {
    const response = await api.post(`/shop/orders/${encodeURIComponent(orderId)}/returns`, input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getReturnsAPI = async (page: number, pageSize = 20): Promise<unknown> => {
  try {
    const response = await api.get('/shop/returns', { params: pageParams(page, pageSize) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
