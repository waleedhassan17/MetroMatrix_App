// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Growth Storefront Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// The kitchen's own link and QR, and the orders they brought.
// docs/API_KITCHEN_ASSUMED.md §2.12 (TODO(API_KITCHEN): an assumed contract). The public page
// itself is the ordinary vendor page (`GET /food/vendors/:slug`).

import { api, toApiError } from '../network/apiHelpers';

export const getStorefrontAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/storefront');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
