// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Settings and Board Network (docs/API_KITCHEN.md §5, §7)
// ═══════════════════════════════════════════════════════
// The settings costing and packing read (the target food cost, whether a
// packing photo is required), and the board's kitchen side.

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
    const data = {
      ...(patch.targetFoodCostPct !== undefined ? { targetFoodCostPct: patch.targetFoodCostPct } : {}),
      ...(patch.packingPhoto !== undefined ? { requirePackingPhoto: patch.packingPhoto === 'required' } : {}),
    };
    const response = await API.PATCH({ URL: '/food/vendor/kitchen/settings', data });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** The board's kitchen side: dishes low on stock or sold out by it, the prep time quotes use now, the packing rule. */
export const fetchBoardHints = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/kitchen/board' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
