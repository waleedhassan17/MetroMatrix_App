// MetroMatrix — the customer's own nutrition (never shown to a kitchen), and
// Food Court's healthy picks.
// docs/API_KITCHEN_ASSUMED.md §2.15 (TODO(API_KITCHEN): an assumed contract).

import { api } from '../network/apiHelpers';
import { request } from '../shopping/http';
import { healthyPicksSerializer, nutritionSettingsSerializer, nutritionSummarySerializer } from '../../serializers/myKitchen/myKitchenSerializer';
import type { NutritionSettings } from '../../types/myKitchen';

export const getNutritionSettings = () => request(() => api.get('/my-kitchen/nutrition/settings'), nutritionSettingsSerializer);

export const saveNutritionSettings = (patch: Partial<Pick<NutritionSettings, 'enabled' | 'showCalories' | 'goal' | 'metrics' | 'manualTargetKcal'>>) =>
  request(() => api.put('/my-kitchen/nutrition/settings', patch), nutritionSettingsSerializer);

/** Everything: settings and body numbers. */
export const deleteNutritionData = () => request(() => api.delete('/my-kitchen/nutrition'), raw => nutritionSettingsSerializer((raw as { settings?: unknown })?.settings));

/** `409 NUTRITION_OFF` while nutrition is off. */
export const getNutritionSummary = (days = 7) => request(() => api.get('/my-kitchen/nutrition/summary', { params: { days } }), nutritionSummarySerializer);

export const listHealthyPicks = (point: { lat: number; lng: number }) => request(() => api.get('/food/healthy-picks', { params: point }), healthyPicksSerializer);
