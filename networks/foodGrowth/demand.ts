// ═══════════════════════════════════════════════════════
// MetroMatrix — Demand Network (docs/API_KITCHEN.md §25)
// ═══════════════════════════════════════════════════════
// Searches near the kitchen that found nothing (or nothing open), and when
// orders come in. A cell or hour with fewer than 5 searches is never shown.

import { API, toApiError, clean } from '../network/network';

/** The city's cells for a week (the newest by default), most unmet first. */
export const fetchDemandMap = async (filter: { cuisineId?: string | null; hour?: number | null; week?: string | null } = {}): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/demand-map', params: clean({ cuisineId: filter.cuisineId, hour: filter.hour ?? undefined, week: filter.week }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Orders per weekday and hour, the kitchen's own and (with 3 or more) its area's. */
export const fetchDemandCurve = async (weeks = 8): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/demand-curve', params: { weeks } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
