// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Insights Cards Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// The hub's numbers and its insight cards.
// docs/API_KITCHEN_ASSUMED.md §4.1 (TODO(API_KITCHEN): an assumed contract).

import { API, toApiError } from '../network/network';

const enc = encodeURIComponent;

/** The hub's tiles: today's numbers (the hub reads them with the cards and the AI meter). */
export const fetchKitchenSummary = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/summary' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchInsightCards = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/insights/cards' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const snoozeInsightCard = async (id: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/kitchen/insights/cards/${enc(id)}/snooze` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
