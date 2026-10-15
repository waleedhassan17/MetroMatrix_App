// MetroMatrix — A location's bookable days and slots.
// TODO(API_HEALTH): paths and shapes from docs/API_HEALTH_ASSUMED.md.

import { api } from '../network/apiHelpers';
import { daysSerializer, slotDaySerializer } from '../../serializers/health/discoverySerializer';
import { clean, request } from '../shopping/http';

const base = (doctorId: string, locationId: string) =>
  `/healthcare/doctors/${encodeURIComponent(doctorId)}/locations/${encodeURIComponent(locationId)}`;

/** The next `days` day chips from `from` (YYYY-MM-DD), each with its free-slot count. */
export const listDays = (doctorId: string, locationId: string, from: string | null, days = 14) =>
  request(() => api.get(`${base(doctorId, locationId)}/days`, { params: clean({ from, days }) }), daysSerializer);

/** One day's free slots, and the next day with any when it has none. */
export const listSlots = (doctorId: string, locationId: string, date: string) =>
  request(() => api.get(`${base(doctorId, locationId)}/slots`, { params: { date } }), slotDaySerializer);
