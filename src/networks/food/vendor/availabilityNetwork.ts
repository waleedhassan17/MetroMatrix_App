// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Vendor Availability Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// What can be ordered right now (dishes and add-ons
// switched off, optionally until a time), and a home kitchen's day: today's
// portions, the weekly menu and pre-order slots.
// docs/API_FOOD.md §4.3 Availability: /food/vendor/{availability,today,preorder-slots,weekly-menu}.

import { api, toApiError } from '../../network/apiHelpers';
import type { PreorderSlot } from '../../../types/food';

export const getAvailabilityAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/availability');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Switch dishes (optionally until a time) and add-ons on or off. */
export const setAvailabilityAPI = async (input: {
  items?: { itemId: string; isAvailable: boolean; unavailableUntil?: string | null }[];
  options?: { optionId: string; isAvailable: boolean }[];
}): Promise<unknown> => {
  try {
    const response = await api.patch('/food/vendor/availability', input);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getTodayAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/today');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Portions reset what is left today; `cooking: false` takes a dish off for today. */
export const setTodayAPI = async (items: { itemId: string; portions?: number | null; cooking?: boolean }[]): Promise<unknown> => {
  try {
    const response = await api.patch('/food/vendor/today', { items });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getPreorderSlotsAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/food/vendor/preorder-slots');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const savePreorderSlotsAPI = async (slots: Omit<PreorderSlot, 'id'>[]): Promise<unknown> => {
  try {
    const response = await api.put('/food/vendor/preorder-slots', slots.map(s => ({ weekday: s.weekday, slotStart: s.slotStart, cutoffMinutesBefore: s.cutoffMinutesBefore, maxOrders: s.maxOrders })));
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const saveWeeklyMenuAPI = async (entries: { itemId: string; days: number[] }[]): Promise<unknown> => {
  try {
    const response = await api.put('/food/vendor/weekly-menu', entries);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
