// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Insights Cards Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// The hub's numbers and its insight cards.
// docs/API_KITCHEN_ASSUMED.md §4.1 (TODO(API_KITCHEN): an assumed contract).

import { api, toApiError } from '../network/apiHelpers';
import { aiUsageSerializer, insightCardsSerializer, kitchenSummarySerializer } from '../../serializers/kitchen/insightSerializer';

const enc = encodeURIComponent;

/** The hub's tiles: today's numbers (the hub reads them with the cards and the AI meter). */
export const getKitchenSummaryAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/kitchen/summary');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getInsightCardsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/kitchen/insights/cards');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const snoozeInsightCardAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.post(`/food/vendor/kitchen/insights/cards/${enc(id)}/snooze`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
