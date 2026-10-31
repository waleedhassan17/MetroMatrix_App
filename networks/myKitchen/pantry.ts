// ═══════════════════════════════════════════════════════
// MetroMatrix — My Kitchen Pantry Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// The customer's pantry.
// docs/API_KITCHEN_ASSUMED.md §2.15, §4.7 (TODO(API_KITCHEN): an assumed contract).

import { API, toApiError } from '../network/network';
import type { PantryLineInput, PantryReminders, PantrySegment } from '../../models/myKitchen';
import type { StandardUnit } from '../../utils/units/units';

const enc = encodeURIComponent;

export const fetchPantry = async (segment: PantrySegment): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/my-kitchen/pantry', params: { segment } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const addToPantry = async (lines: PantryLineInput[], source: 'manual' | 'voice' = 'manual'): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/my-kitchen/pantry', data: { source, lines } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updatePantryItem = async (id: string, patch: { qty?: number; unit?: StandardUnit; expiresOn?: string | null }): Promise<unknown> => {
  try {
    const response = await API.PATCH({ URL: `/my-kitchen/pantry/${enc(id)}`, data: patch });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Thrown away. */
export const removePantryItem = async (id: string): Promise<unknown> => {
  try {
    const response = await API.DELETE({ URL: `/my-kitchen/pantry/${enc(id)}` });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** All of it, or some (`qty`, `unit`). */
export const markPantryUsed = async (id: string, some?: { qty: number; unit: StandardUnit }): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: `/my-kitchen/pantry/${enc(id)}/use`, data: some ?? {} });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchGroceryOrders = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/my-kitchen/pantry/shopping-orders' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const addFromShoppingOrder = async (orderId: string, lineIds: string[]): Promise<unknown> => {
  try {
    const response = await API.POST({ URL: '/my-kitchen/pantry/from-shopping-order', data: { orderId, lineIds } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchPantryReminders = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/my-kitchen/pantry/reminders' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const savePantryReminders = async (r: Partial<PantryReminders>): Promise<unknown> => {
  try {
    const response = await API.PUT({ URL: '/my-kitchen/pantry/reminders', data: r });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const fetchPantryStats = async (month?: string): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/my-kitchen/stats', params: month ? { month } : undefined });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
