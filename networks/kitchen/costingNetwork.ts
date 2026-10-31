// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Costing Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// The settings costs and the board read (target food
// cost, selling a dish out by stock, the packing photo rule).
// docs/API_KITCHEN_ASSUMED.md §4.1 (TODO(API_KITCHEN): an assumed contract).

import { api, toApiError } from '../network/apiHelpers';
import type { KitchenSettings } from '../../types/kitchen';

export const getKitchenSettingsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/kitchen/settings');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updateKitchenSettingsAPI = async (patch: Partial<KitchenSettings>): Promise<unknown> => {
  try {
    const response = await api.patch('/food/vendor/kitchen/settings', patch);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The board's kitchen side: dishes low on stock or sold out by it, and the usual prep time now. */
export const getBoardHintsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/kitchen/board');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
