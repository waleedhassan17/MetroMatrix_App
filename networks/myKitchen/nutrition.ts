// ═══════════════════════════════════════════════════════
// MetroMatrix — My Nutrition Network (docs/API_KITCHEN.md §34)
// ═══════════════════════════════════════════════════════
// The opt-in profile (no profile: nutrition is off; deleting it removes all
// of it), the summary of food ordered on MetroMatrix, and kitchens with
// lighter dishes. No kitchen ever reads any of it.

import { API, toApiError, clean } from '../network/network';
import type { BodyMetrics, NutritionGoal } from '../../models/myKitchen';

/** 404 NOT_FOUND when there is no profile (nutrition is off). */
export const fetchNutritionProfile = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/me/nutrition/profile' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Your own target, or the Mifflin-St Jeor one from your details, or none ("eat better": maintain, no target). */
export const saveNutritionProfile = async (input: { goal: NutritionGoal; metrics: BodyMetrics | null; manualTargetKcal: number | null; showCalories: boolean }): Promise<unknown> => {
  try {
    const data = {
      goal: input.goal === 'eat_better' ? 'maintain' : input.goal,
      showCalories: input.showCalories,
      ...(input.manualTargetKcal ? { manualTargetKcal: input.manualTargetKcal } : {}),
      ...(input.goal !== 'eat_better' && !input.manualTargetKcal && input.metrics ? clean({ ...input.metrics }) : {}),
    };
    const response = await API.PUT({ URL: '/food/me/nutrition/profile', data });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** "Delete my nutrition data": the profile row goes. */
export const deleteNutritionProfile = async (): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: '/food/me/nutrition/profile' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Estimated, from delivered and picked-up food orders only. */
export const fetchNutritionSummary = async (range: '7d' | '30d' = '7d'): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/me/nutrition/summary', params: { range } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Kitchens near you with at least one visible dish under 600 kcal. */
export const fetchHealthyPicks = async (point: { lat: number; lng: number }): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendors', params: { lat: point.lat, lng: point.lng, maxKcal: 600 } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
