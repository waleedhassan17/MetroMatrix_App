// MetroMatrix — Food vendor: what can be ordered right now (dishes and add-ons
// switched off, optionally until a time), and a home kitchen's day: today's
// portions, the weekly menu and pre-order slots.
// docs/API_FOOD.md §4.3 Availability: /food/vendor/{availability,today,preorder-slots,weekly-menu}.

import { api } from '../../network/apiHelpers';
import { menuAvailabilitySerializer, preorderSlotsSerializer, todayMenuSerializer, weeklyMenuSerializer } from '../../../serializers/food/menuSerializer';
import type { PreorderSlot } from '../../../types/food';
import { request } from '../../shopping/http';

export const getAvailability = () => request(() => api.get('/food/vendor/availability'), menuAvailabilitySerializer);

/** Switch dishes (optionally until a time) and add-ons on or off. */
export const setAvailability = (input: {
  items?: { itemId: string; isAvailable: boolean; unavailableUntil?: string | null }[];
  options?: { optionId: string; isAvailable: boolean }[];
}) => request(() => api.patch('/food/vendor/availability', input), menuAvailabilitySerializer);

export const getToday = () => request(() => api.get('/food/vendor/today'), todayMenuSerializer);

/** Portions reset what is left today; `cooking: false` takes a dish off for today. */
export const setToday = (items: { itemId: string; portions?: number | null; cooking?: boolean }[]) =>
  request(() => api.patch('/food/vendor/today', { items }), todayMenuSerializer);

export const getPreorderSlots = () => request(() => api.get('/food/vendor/preorder-slots'), preorderSlotsSerializer);

export const savePreorderSlots = (slots: Omit<PreorderSlot, 'id'>[]) =>
  request(
    () => api.put('/food/vendor/preorder-slots', slots.map(s => ({ weekday: s.weekday, slotStart: s.slotStart, cutoffMinutesBefore: s.cutoffMinutesBefore, maxOrders: s.maxOrders }))),
    preorderSlotsSerializer,
  );

export const saveWeeklyMenu = (entries: { itemId: string; days: number[] }[]) => request(() => api.put('/food/vendor/weekly-menu', entries), weeklyMenuSerializer);
