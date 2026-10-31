// ═══════════════════════════════════════════════════════
// MetroMatrix — My Kitchen Nutrition Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Food Court's healthy picks.
// docs/API_KITCHEN_ASSUMED.md §2.15 (TODO(API_KITCHEN): an assumed contract).

import { API, toApiError } from '../network/network';
import type { NutritionSettings } from '../../models/myKitchen';

export const fetchNutritionSettings = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/my-kitchen/nutrition/settings' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const saveNutritionSettings = async (patch: Partial<Pick<NutritionSettings, 'enabled' | 'showCalories' | 'goal' | 'metrics' | 'manualTargetKcal'>>): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: '/my-kitchen/nutrition/settings', data: patch });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Everything: settings and body numbers. */
export const deleteNutritionData = async (): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: '/my-kitchen/nutrition' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** `409 NUTRITION_OFF` while nutrition is off. */
export const fetchNutritionSummary = async (days = 7): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/my-kitchen/nutrition/summary', params: { days } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchHealthyPicks = async (point: { lat: number; lng: number }): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/healthy-picks', params: point });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
