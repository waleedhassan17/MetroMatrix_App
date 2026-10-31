// ═══════════════════════════════════════════════════════
// MetroMatrix — My Kitchen Nutrition Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Food Court's healthy picks.
// docs/API_KITCHEN_ASSUMED.md §2.15 (TODO(API_KITCHEN): an assumed contract).

import { api, toApiError } from '../network/apiHelpers';
import type { NutritionSettings } from '../../models/myKitchen';

export const getNutritionSettingsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/my-kitchen/nutrition/settings');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const saveNutritionSettingsAPI = async (patch: Partial<Pick<NutritionSettings, 'enabled' | 'showCalories' | 'goal' | 'metrics' | 'manualTargetKcal'>>): Promise<unknown> => {
  try {
    const response = await api.put('/my-kitchen/nutrition/settings', patch);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Everything: settings and body numbers. */
export const deleteNutritionDataAPI = async (): Promise<unknown> => {
  try {
    const response = await api.delete('/my-kitchen/nutrition');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** `409 NUTRITION_OFF` while nutrition is off. */
export const getNutritionSummaryAPI = async (days = 7): Promise<unknown> => {
  try {
    const response = await api.get('/my-kitchen/nutrition/summary', { params: { days } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getHealthyPicksAPI = async (point: { lat: number; lng: number }): Promise<unknown> => {
  try {
    const response = await api.get('/food/healthy-picks', { params: point });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
