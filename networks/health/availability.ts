// ═══════════════════════════════════════════════════════
// MetroMatrix — Health Availability Network (API_HEALTH.md)
// ═══════════════════════════════════════════════════════
// MetroMatrix-API docs/API_HEALTH.md §2 (Slots): one route, a run of days from `from` (at most 14).

import { API, toApiError, clean } from '../network/network';

const enc = encodeURIComponent;
const slots = (doctorId: string, locationId: string) => `/health/doctors/${enc(doctorId)}/locations/${enc(locationId)}/slots`;

/** The next `days` day chips from `from` (YYYY-MM-DD), each with its free-slot count. */
export const fetchDays = async (doctorId: string, locationId: string, from: string | null, days = 14): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: slots(doctorId, locationId), params: clean({ from, days: Math.min(14, Math.max(1, days)) }) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** One day's free slots; when it has none, the next day that does (a fortnight is asked for). */
export const fetchSlots = async (doctorId: string, locationId: string, date: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: slots(doctorId, locationId), params: { from: date, days: 14 } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
