// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Growth Ramadan Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// Ramadan hours for the kitchen, and "Iftar near you".
// docs/API_KITCHEN_ASSUMED.md §2.11, §3.11 (TODO(API_KITCHEN): an assumed contract).

import { API, toApiError } from '../network/network';
import type { RamadanInput } from '../../models/kitchen';

export const fetchRamadan = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/ramadan' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** `409 RAMADAN_NOT_ACTIVE { event, opensOn }` outside the event and the month before it. */
export const updateRamadan = async (input: RamadanInput): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: '/food/vendor/ramadan', data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchIftarNearby = async (point: { lat: number; lng: number }): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/ramadan/iftar', params: point });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
