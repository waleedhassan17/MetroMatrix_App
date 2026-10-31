// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Costing Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// The settings costs and the board read (target food
// cost, selling a dish out by stock, the packing photo rule).
// docs/API_KITCHEN_ASSUMED.md §4.1 (TODO(API_KITCHEN): an assumed contract).

import { API, toApiError } from '../network/network';
import type { KitchenSettings } from '../../models/kitchen';

export const fetchKitchenSettings = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/settings' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateKitchenSettings = async (patch: Partial<KitchenSettings>): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: '/food/vendor/kitchen/settings', data: patch });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The board's kitchen side: dishes low on stock or sold out by it, and the usual prep time now. */
export const fetchBoardHints = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/board' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
