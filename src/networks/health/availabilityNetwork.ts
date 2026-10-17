// MetroMatrix — A location's bookable days and slots.
// MetroMatrix-API docs/API_HEALTH.md §2 (Slots): one route, a run of days from `from` (at most 14).

import { api } from '../network/apiHelpers';
import { daysSerializer, slotDaySerializer } from '../../serializers/health/discoverySerializer';
import { clean, request } from '../shopping/http';

const enc = encodeURIComponent;
const slots = (doctorId: string, locationId: string) => `/health/doctors/${enc(doctorId)}/locations/${enc(locationId)}/slots`;

/** The next `days` day chips from `from` (YYYY-MM-DD), each with its free-slot count. */
export const listDays = (doctorId: string, locationId: string, from: string | null, days = 14) =>
  request(() => api.get(slots(doctorId, locationId), { params: clean({ from, days: Math.min(14, Math.max(1, days)) }) }), daysSerializer);

/** One day's free slots; when it has none, the next day that does (a fortnight is asked for). */
export const listSlots = (doctorId: string, locationId: string, date: string) =>
  request(() => api.get(slots(doctorId, locationId), { params: { from: date, days: 14 } }), slotDaySerializer);
