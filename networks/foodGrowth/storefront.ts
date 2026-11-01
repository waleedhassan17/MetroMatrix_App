// ═══════════════════════════════════════════════════════
// MetroMatrix — Storefront Network (docs/API_KITCHEN.md §22)
// ═══════════════════════════════════════════════════════
// The kitchen's own link and QR, and the orders they brought.

import { API, toApiError } from '../network/network';

/** `days` 7–90 (default 30). */
export const fetchStorefront = async (days = 30): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/storefront', params: { days } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
