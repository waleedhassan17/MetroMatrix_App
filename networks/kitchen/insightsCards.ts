// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Insights Cards Network (docs/API_KITCHEN.md §7)
// ═══════════════════════════════════════════════════════
// The Kitchen tab's numbers and its insight cards.

import { API, toApiError } from '../network/network';

const enc = encodeURIComponent;

/** The Kitchen tab's numbers in one read (the hub reads them with the cards and the AI meter). */
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

/** Away for 24 hours, by the card's key. */
export const snoozeInsightCard = async (key: string): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/food/vendor/kitchen/insights/cards/${enc(key)}/snooze` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
