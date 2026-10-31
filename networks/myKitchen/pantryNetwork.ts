// ═══════════════════════════════════════════════════════
// MetroMatrix — My Kitchen Pantry Network (API_KITCHEN_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// The customer's pantry.
// docs/API_KITCHEN_ASSUMED.md §2.15, §4.7 (TODO(API_KITCHEN): an assumed contract).

import { api, toApiError } from '../network/apiHelpers';
import type { PantryLineInput, PantryReminders, PantrySegment } from '../../types/myKitchen';
import type { StandardUnit } from '../../utils/units';

const enc = encodeURIComponent;

export const getPantryAPI = async (segment: PantrySegment): Promise<unknown> => {
  try {
    const response = await api.get('/my-kitchen/pantry', { params: { segment } });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const addToPantryAPI = async (lines: PantryLineInput[], source: 'manual' | 'voice' = 'manual'): Promise<unknown> => {
  try {
    const response = await api.post('/my-kitchen/pantry', { source, lines });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const updatePantryItemAPI = async (id: string, patch: { qty?: number; unit?: StandardUnit; expiresOn?: string | null }): Promise<unknown> => {
  try {
    const response = await api.patch(`/my-kitchen/pantry/${enc(id)}`, patch);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** Thrown away. */
export const removePantryItemAPI = async (id: string): Promise<unknown> => {
  try {
    const response = await api.delete(`/my-kitchen/pantry/${enc(id)}`);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

/** All of it, or some (`qty`, `unit`). */
export const markPantryUsedAPI = async (id: string, some?: { qty: number; unit: StandardUnit }): Promise<unknown> => {
  try {
    const response = await api.post(`/my-kitchen/pantry/${enc(id)}/use`, some ?? {});
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getGroceryOrdersAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/my-kitchen/pantry/shopping-orders');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const addFromShoppingOrderAPI = async (orderId: string, lineIds: string[]): Promise<unknown> => {
  try {
    const response = await api.post('/my-kitchen/pantry/from-shopping-order', { orderId, lineIds });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getPantryRemindersAPI = async (): Promise<unknown> => {
  try {
    const response = await api.get('/my-kitchen/pantry/reminders');
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const savePantryRemindersAPI = async (r: Partial<PantryReminders>): Promise<unknown> => {
  try {
    const response = await api.put('/my-kitchen/pantry/reminders', r);
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const getPantryStatsAPI = async (month?: string): Promise<unknown> => {
  try {
    const response = await api.get('/my-kitchen/stats', { params: month ? { month } : undefined });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
