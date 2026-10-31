// ═══════════════════════════════════════════════════════
// MetroMatrix — Food Vendor Availability Network (API_FOOD.md)
// ═══════════════════════════════════════════════════════
// What can be ordered right now (dishes and add-ons
// switched off, optionally until a time), and a home kitchen's day: today's
// portions, the weekly menu and pre-order slots.
// docs/API_FOOD.md §4.3 Availability: /food/vendor/{availability,today,preorder-slots,weekly-menu}.

import { API, toApiError } from '../../network/network';
import type { PreorderSlot } from '../../../models/food';

export const fetchAvailability = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/availability' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Switch dishes (optionally until a time) and add-ons on or off. */
export const setAvailability = async (input: {
  items?: { itemId: string; isAvailable: boolean; unavailableUntil?: string | null }[];
  options?: { optionId: string; isAvailable: boolean }[];
}): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: '/food/vendor/availability', data: input });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchToday = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/today' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Portions reset what is left today; `cooking: false` takes a dish off for today. */
export const setToday = async (items: { itemId: string; portions?: number | null; cooking?: boolean }[]): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: '/food/vendor/today', data: { items } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchPreorderSlots = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/preorder-slots' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const savePreorderSlots = async (slots: Omit<PreorderSlot, 'id'>[]): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: '/food/vendor/preorder-slots', data: slots.map(s => ({ weekday: s.weekday, slotStart: s.slotStart, cutoffMinutesBefore: s.cutoffMinutesBefore, maxOrders: s.maxOrders })) });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const saveWeeklyMenu = async (entries: { itemId: string; days: number[] }[]): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: '/food/vendor/weekly-menu', data: entries });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
