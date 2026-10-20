// MetroMatrix — Food Court: Ramadan hours for the kitchen, and "Iftar near you".
// docs/API_KITCHEN_ASSUMED.md §2.11, §3.11 (TODO(API_KITCHEN): an assumed contract).

import { api } from '../network/apiHelpers';
import { request } from '../shopping/http';
import { iftarNearbySerializer, ramadanSettingsSerializer } from '../../serializers/kitchen/reachSerializer';
import type { RamadanInput } from '../../types/kitchen';

export const getRamadan = () => request(() => api.get('/food/vendor/ramadan'), ramadanSettingsSerializer);

/** `409 RAMADAN_NOT_ACTIVE { event, opensOn }` outside the event and the month before it. */
export const updateRamadan = (input: RamadanInput) => request(() => api.put('/food/vendor/ramadan', input), ramadanSettingsSerializer);

export const listIftarNearby = (point: { lat: number; lng: number }) => request(() => api.get('/food/ramadan/iftar', { params: point }), iftarNearbySerializer);
