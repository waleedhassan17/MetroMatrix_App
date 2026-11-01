// ═══════════════════════════════════════════════════════
// MetroMatrix — Ramadan Network (docs/API_KITCHEN.md §21)
// ═══════════════════════════════════════════════════════
// The kitchen's sehri and iftar windows. Customers find iftar near them on
// the Food home's `iftarNearYou` rail.

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

/** The whole settings: a window is both ends or neither (null clears it). */
export const updateRamadan = async (input: RamadanInput): Promise<unknown> => {
  try {
    const data = {
      enabled: input.enabled ?? false,
      sehriFrom: input.sehri?.from ?? null,
      sehriTo: input.sehri?.to ?? null,
      iftarFrom: input.iftar?.from ?? null,
      iftarTo: input.iftar?.to ?? null,
      iftarPreorderOnly: input.iftarPreorderOnly ?? false,
    };
    const response = await API.PUT({ URL: '/food/vendor/ramadan', data });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
